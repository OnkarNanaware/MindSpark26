"""
security/sast/ast/python_analyzer.py
Python AST-based static analyzer.
Uses Python stdlib `ast` module — real AST, not regex.
Implements intra-file + basic inter-procedural taint tracking.
"""
import ast
import os
import logging
from typing import List, Dict, Optional, Any
from ..taint import TaintState, TaintedVar, TaintSource, get_source, PYTHON_SOURCE_NAMES

log = logging.getLogger(__name__)

MAX_FILE_SIZE   = 10 * 1024 * 1024   # 10 MB
MAX_AST_DEPTH   = 50
SNIPPET_CONTEXT = 5                   # lines of context around finding


# ── Finding dataclass ─────────────────────────────────────────────────────────

def make_finding(rule_id, type_, severity, confidence, file_path,
                 line, col, source_name, sink_name, data_flow,
                 description, remediation, snippet=None):
    return {
        'rule_id':     rule_id,
        'type':        type_,
        'severity':    severity,
        'confidence':  confidence,
        'file':        file_path,
        'line':        line,
        'col':         col or 0,
        'source':      source_name,
        'sink':        sink_name,
        'data_flow':   data_flow,
        'description': description,
        'remediation': remediation,
        'snippet':     snippet,
        'status':      'OPEN',
        'language':    'python',
    }


# ── AST Helpers ───────────────────────────────────────────────────────────────

def _attr_chain(node) -> str:
    """Turn Attribute/Name chains into dotted strings: request.args.get"""
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return f"{_attr_chain(node.value)}.{node.attr}"
    return ''


def _node_loc(node) -> str:
    return f"line {getattr(node, 'lineno', '?')}"


def _extract_snippet(lines: List[str], lineno: int) -> List[str]:
    start = max(0, lineno - 1 - SNIPPET_CONTEXT)
    end   = min(len(lines), lineno + SNIPPET_CONTEXT)
    return lines[start:end]


# ── Main Analyzer ─────────────────────────────────────────────────────────────

class PythonAnalyzer(ast.NodeVisitor):
    """
    Walks a Python AST and detects security issues via taint tracking.
    Covers: SQL injection, command injection, eval/exec, pickle, hardcoded secrets.
    """

    def __init__(self, file_path: str, source_lines: List[str]):
        self.file_path    = file_path
        self.source_lines = source_lines
        self.findings: List[dict] = []
        self.taint        = TaintState()
        # function_taints: maps function name -> param_index -> TaintedVar
        self.function_params: Dict[str, Dict[int, str]] = {}
        # Collect all function defs for inter-procedural analysis
        self._functions: Dict[str, ast.FunctionDef] = {}
        self._analyzing_depth = 0

    # ── Visitor methods ───────────────────────────────────────────────────────

    def visit_FunctionDef(self, node: ast.FunctionDef):
        self._functions[node.name] = node
        self.generic_visit(node)

    visit_AsyncFunctionDef = visit_FunctionDef

    def visit_Assign(self, node: ast.Assign):
        """Track taint through variable assignments."""
        rhs_taint = self._eval_expr_taint(node.value)
        if rhs_taint:
            for target in node.targets:
                if isinstance(target, ast.Name):
                    new_tv = rhs_taint.extend(target.id, _node_loc(node))
                    self.taint.mark_tainted(target.id, new_tv)
        self.generic_visit(node)

    def visit_AugAssign(self, node: ast.AugAssign):
        """Handle += string concatenation."""
        if isinstance(node.target, ast.Name):
            lhs_taint = self.taint.get_taint(node.target.id)
            rhs_taint = self._eval_expr_taint(node.value)
            if lhs_taint or rhs_taint:
                base = lhs_taint or rhs_taint
                self.taint.mark_tainted(
                    node.target.id,
                    base.extend(node.target.id, _node_loc(node))
                )
        self.generic_visit(node)

    def visit_Call(self, node: ast.Call):
        """Detect sink calls with tainted arguments."""
        func_str = _attr_chain(node.func)
        self._check_sql_sink(node, func_str)
        self._check_cmd_sink(node, func_str)
        self._check_eval_sink(node, func_str)
        self._check_pickle_sink(node, func_str)
        self._check_secret_in_call(node, func_str)
        self.generic_visit(node)

    def visit_Expr(self, node: ast.Expr):
        """Handle top-level expression statements (e.g., bare calls)."""
        self.generic_visit(node)

    # ── Taint evaluation ─────────────────────────────────────────────────────

    def _eval_expr_taint(self, node) -> Optional[TaintedVar]:
        """Return a TaintedVar if the expression is or contains tainted data."""
        if node is None:
            return None

        # Direct source: request.args.get("x"), request.form, etc.
        chain = _attr_chain(node)
        if chain:
            for src_name in PYTHON_SOURCE_NAMES:
                if chain == src_name or chain.startswith(src_name + '.') or chain.startswith(src_name + '('):
                    src = get_source(src_name, 'python')
                    return TaintedVar(
                        name=chain,
                        source=src,
                        source_location=_node_loc(node),
                        propagation_path=[f"Source: {chain}"],
                    )

        # Call: request.args.get(...) — the call is also a source
        if isinstance(node, ast.Call):
            func_chain = _attr_chain(node.func)
            for src_name in PYTHON_SOURCE_NAMES:
                if func_chain and (func_chain == src_name or func_chain.startswith(src_name)):
                    src = get_source(src_name, 'python')
                    return TaintedVar(
                        name=func_chain,
                        source=src,
                        source_location=_node_loc(node),
                        propagation_path=[f"Source call: {func_chain}(...)"],
                    )
            # Check taint from args
            for arg in node.args:
                t = self._eval_expr_taint(arg)
                if t:
                    return t

        # Name reference: if the variable is already tainted
        if isinstance(node, ast.Name):
            return self.taint.get_taint(node.id)

        # Binary op (string concat): "SELECT " + user_input
        if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
            left  = self._eval_expr_taint(node.left)
            right = self._eval_expr_taint(node.right)
            return left or right

        # f-string: f"SELECT {var}"
        if isinstance(node, ast.JoinedStr):
            for val in node.values:
                t = self._eval_expr_taint(val)
                if t:
                    return t

        # FormattedValue inside f-string
        if isinstance(node, ast.FormattedValue):
            return self._eval_expr_taint(node.value)

        # .format() call
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
            if node.func.attr == 'format':
                for arg in node.args + [kw.value for kw in node.keywords]:
                    t = self._eval_expr_taint(arg)
                    if t:
                        return t

        # % formatting: "SELECT %s" % var
        if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Mod):
            return self._eval_expr_taint(node.right)

        return None

    # ── Sink checkers ─────────────────────────────────────────────────────────

    SQL_SINKS = {
        'cursor.execute', 'cursor.executemany',
        'connection.execute', 'conn.execute', 'db.execute',
        'session.execute',
    }

    def _check_sql_sink(self, node: ast.Call, func_str: str):
        if not any(func_str == s or func_str.endswith('.' + s.split('.')[-1])
                   for s in self.SQL_SINKS):
            return
        if not node.args:
            return

        query_arg = node.args[0]
        taint = self._eval_expr_taint(query_arg)
        if not taint:
            return

        # Parameterized query check: cursor.execute("...", (params,))
        # If query_arg is a plain string constant AND there are positional params → safe
        if isinstance(query_arg, ast.Constant) and isinstance(query_arg.value, str):
            if len(node.args) > 1 or node.keywords:
                return  # parameterized — NOT a finding

        data_flow = (taint.propagation_path or []) + [f"→ {func_str}() at {_node_loc(node)}"]
        self.findings.append(make_finding(
            rule_id='SAGE-SQL-001',
            type_='SQL_INJECTION',
            severity='HIGH',
            confidence='HIGH',
            file_path=self.file_path,
            line=getattr(node, 'lineno', 0),
            col=getattr(node, 'col_offset', 0),
            source_name=taint.source.name if taint.source else taint.name,
            sink_name=func_str,
            data_flow=data_flow,
            description=(
                f"User-controlled input from {taint.source.name if taint.source else taint.name!r} "
                f"reaches SQL execution sink {func_str!r} through string construction. "
                f"This may allow an attacker to modify the SQL query."
            ),
            remediation=(
                "Use parameterized queries: cursor.execute('SELECT * FROM t WHERE id=%s', (user_id,)). "
                "Never concatenate user input directly into SQL strings."
            ),
            snippet=_extract_snippet(self.source_lines, getattr(node, 'lineno', 0)),
        ))

    CMD_SINKS = {
        'os.system', 'os.popen', 'os.execv', 'os.execvp',
        'subprocess.run', 'subprocess.call', 'subprocess.Popen',
        'subprocess.check_output', 'subprocess.check_call',
    }

    def _check_cmd_sink(self, node: ast.Call, func_str: str):
        if not any(func_str == s or func_str.endswith('.' + s.split('.')[-1])
                   for s in self.CMD_SINKS):
            return

        # Check for shell=True keyword
        shell_true = any(
            isinstance(kw.value, ast.Constant) and kw.value.value is True
            for kw in node.keywords if kw.arg == 'shell'
        )

        taint = None
        for arg in node.args:
            taint = self._eval_expr_taint(arg)
            if taint:
                break

        if not taint and not shell_true:
            return

        confidence = 'HIGH' if taint else 'MEDIUM'
        data_flow  = []
        if taint:
            data_flow = (taint.propagation_path or []) + [f"→ {func_str}() at {_node_loc(node)}"]

        self.findings.append(make_finding(
            rule_id='SAGE-CMD-001',
            type_='COMMAND_INJECTION',
            severity='HIGH',
            confidence=confidence,
            file_path=self.file_path,
            line=getattr(node, 'lineno', 0),
            col=getattr(node, 'col_offset', 0),
            source_name=taint.source.name if taint and taint.source else 'user_input',
            sink_name=func_str,
            data_flow=data_flow,
            description=(
                f"User-controlled input may reach command execution sink {func_str!r}. "
                + ("shell=True detected, which enables shell injection." if shell_true else "")
            ),
            remediation=(
                "Avoid shell=True. Use subprocess with a list of arguments: "
                "subprocess.run(['cmd', arg], shell=False). Validate and sanitize all inputs."
            ),
            snippet=_extract_snippet(self.source_lines, getattr(node, 'lineno', 0)),
        ))

    EVAL_SINKS = {'eval', 'exec', 'compile'}

    def _check_eval_sink(self, node: ast.Call, func_str: str):
        if func_str not in self.EVAL_SINKS:
            return
        taint = None
        for arg in node.args:
            taint = self._eval_expr_taint(arg)
            if taint:
                break

        data_flow = []
        if taint:
            data_flow = (taint.propagation_path or []) + [f"→ {func_str}() at {_node_loc(node)}"]

        confidence = 'HIGH' if taint else 'LOW'
        self.findings.append(make_finding(
            rule_id='SAGE-EVAL-001',
            type_='DANGEROUS_EVAL',
            severity='HIGH',
            confidence=confidence,
            file_path=self.file_path,
            line=getattr(node, 'lineno', 0),
            col=getattr(node, 'col_offset', 0),
            source_name=taint.source.name if taint and taint.source else 'dynamic',
            sink_name=func_str,
            data_flow=data_flow,
            description=(
                f"{func_str!r} with dynamic input can execute arbitrary Python code."
            ),
            remediation=(
                f"Avoid {func_str}() entirely. Use AST-safe alternatives like "
                "ast.literal_eval() for parsing data structures."
            ),
            snippet=_extract_snippet(self.source_lines, getattr(node, 'lineno', 0)),
        ))

    PICKLE_SINKS = {'pickle.loads', 'pickle.load', 'cPickle.loads', 'cPickle.load'}

    def _check_pickle_sink(self, node: ast.Call, func_str: str):
        if not any(func_str == s for s in self.PICKLE_SINKS):
            return
        taint = None
        for arg in node.args:
            taint = self._eval_expr_taint(arg)
            if taint:
                break

        confidence = 'HIGH' if taint else 'MEDIUM'
        data_flow  = []
        if taint:
            data_flow = (taint.propagation_path or []) + [f"→ {func_str}() at {_node_loc(node)}"]

        self.findings.append(make_finding(
            rule_id='SAGE-DESER-001',
            type_='UNSAFE_DESERIALIZATION',
            severity='HIGH',
            confidence=confidence,
            file_path=self.file_path,
            line=getattr(node, 'lineno', 0),
            col=getattr(node, 'col_offset', 0),
            source_name=taint.source.name if taint and taint.source else 'external_data',
            sink_name=func_str,
            data_flow=data_flow,
            description=(
                f"pickle.loads() with potentially untrusted data can execute arbitrary code "
                f"during deserialization."
            ),
            remediation=(
                "Never deserialize pickle data from untrusted sources. "
                "Use JSON or other safe serialization formats instead."
            ),
            snippet=_extract_snippet(self.source_lines, getattr(node, 'lineno', 0)),
        ))

    # Secret patterns (variable names + values)
    SECRET_VAR_PATTERNS = [
        'password', 'passwd', 'secret', 'api_key', 'apikey', 'token',
        'private_key', 'access_key', 'auth_token', 'credentials',
        'aws_secret', 'stripe_key', 'client_secret',
    ]

    def _check_secret_in_call(self, node: ast.Call, func_str: str):
        # Check keyword arguments for hardcoded secrets
        for kw in node.keywords:
            if kw.arg and any(p in kw.arg.lower() for p in self.SECRET_VAR_PATTERNS):
                if isinstance(kw.value, ast.Constant) and isinstance(kw.value.value, str):
                    val = kw.value.value
                    if len(val) > 8 and not val.startswith('$') and not val.startswith('{'):
                        self._emit_secret(
                            node, kw.arg, val,
                            f"Potential hardcoded credential in keyword argument {kw.arg!r}"
                        )

    def visit_Assign_for_secrets(self, node: ast.Assign):
        """Detect hardcoded secrets in assignment statements."""
        for target in node.targets:
            if not isinstance(target, ast.Name):
                continue
            var = target.id.lower()
            if not any(p in var for p in self.SECRET_VAR_PATTERNS):
                continue
            if isinstance(node.value, ast.Constant) and isinstance(node.value.value, str):
                val = node.value.value
                if len(val) > 8 and not val.startswith('$') and not val.startswith('{'):
                    self._emit_secret(node, target.id, val,
                                      f"Potential hardcoded secret in variable {target.id!r}")

    def _emit_secret(self, node, var_name: str, value: str, description: str):
        # Fingerprint: first 4 chars + length — never store actual value
        fingerprint = f"{value[:4]}...({len(value)} chars)"
        self.findings.append({
            'rule_id':     'SAGE-SECRET-001',
            'type':        'HARDCODED_SECRET',
            'severity':    'HIGH',
            'confidence':  'MEDIUM',
            'file':        self.file_path,
            'line':        getattr(node, 'lineno', 0),
            'col':         getattr(node, 'col_offset', 0),
            'source':      var_name,
            'sink':        'hardcoded_value',
            'data_flow':   [f"{var_name} = <redacted>"],
            'description': description,
            'remediation': (
                "Store secrets in environment variables or a secrets manager. "
                "Never hardcode credentials in source code."
            ),
            'redacted_value': '********',
            'fingerprint':    fingerprint,
            'secret_type':    _classify_secret(var_name),
            'status':         'OPEN',
            'language':       'python',
            'is_secret':      True,
        })


def _classify_secret(var_name: str) -> str:
    v = var_name.lower()
    if 'aws' in v:       return 'AWS credential'
    if 'stripe' in v:    return 'Payment credential'
    if 'api_key' in v or 'apikey' in v: return 'API key'
    if 'token' in v:     return 'Auth token'
    if 'password' in v or 'passwd' in v: return 'Password'
    if 'private_key' in v: return 'Private key'
    return 'Credential'


# ── Public API ────────────────────────────────────────────────────────────────

def analyze_file(file_path: str) -> List[dict]:
    """
    Parse and analyze a Python source file.
    Returns a list of finding dicts (empty list on parse error or empty file).
    """
    try:
        size = os.path.getsize(file_path)
        if size > MAX_FILE_SIZE:
            log.warning(f"Skipping oversized Python file: {file_path} ({size // 1024}KB)")
            return [{'status': 'SKIPPED', 'reason': 'RESOURCE_LIMIT', 'file': file_path}]

        with open(file_path, 'r', encoding='utf-8', errors='replace') as fh:
            source = fh.read()
            lines  = source.splitlines()

        try:
            tree = ast.parse(source, filename=file_path)
        except SyntaxError as e:
            log.debug(f"Python syntax error in {file_path}: {e}")
            return []

        analyzer = PythonAnalyzer(file_path, lines)

        # First pass: collect function definitions for inter-procedural analysis
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                analyzer._functions[node.name] = node

        # Second pass: full analysis
        analyzer.visit(tree)

        # Separate pass for secret detection in assignments (visit doesn't catch it)
        for node in ast.walk(tree):
            if isinstance(node, ast.Assign):
                analyzer.visit_Assign_for_secrets(node)

        log.debug(f"Python: analyzed {file_path} — {len(analyzer.findings)} findings")
        return analyzer.findings

    except PermissionError:
        log.warning(f"Permission denied reading {file_path}")
        return []
    except Exception as e:
        log.warning(f"Python analysis failed for {file_path}: {e}")
        return []
