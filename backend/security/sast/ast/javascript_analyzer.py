"""
security/sast/ast/javascript_analyzer.py
JavaScript/TypeScript pattern-based static analyzer.
LIMITATION: Uses line-by-line pattern matching, not a full JS AST.
A full AST-based JS analyzer would require Tree-sitter or similar native bindings.
This implementation is documented as pattern-based and designed to be replaced
by a proper JS AST engine (e.g. Tree-sitter via py-tree-sitter) in a future phase.
"""
import os
import re
import logging
from typing import List

log = logging.getLogger(__name__)

MAX_FILE_SIZE   = 5 * 1024 * 1024    # 5 MB
SNIPPET_CONTEXT = 5

# ── Source patterns ───────────────────────────────────────────────────────────

JS_SOURCES = [
    (re.compile(r'\breq\.query\b'),   'req.query',   'express'),
    (re.compile(r'\breq\.body\b'),    'req.body',    'express'),
    (re.compile(r'\breq\.params\b'),  'req.params',  'express'),
    (re.compile(r'\breq\.headers\b'), 'req.headers', 'express'),
]

# ── Sink patterns ─────────────────────────────────────────────────────────────

SQL_SINK_RE      = re.compile(r'\b(db|pool|connection|client|conn|knex|sequelize)\s*\.\s*(query|execute|raw)\s*\(')
CMD_SINK_RE      = re.compile(r'\b(exec|execSync|spawn|spawnSync)\s*\(|child_process\s*\.\s*(exec|spawn)\s*\(')
EVAL_SINK_RE     = re.compile(r'\beval\s*\(|new\s+Function\s*\(')
TEMPLATE_TAINT   = re.compile(r'`[^`]*\$\{([^}]+)\}[^`]*`')
CONCAT_SQL       = re.compile(r'["\'][^"\']*(?:SELECT|INSERT|UPDATE|DELETE|WHERE|FROM)[^"\']*["\'\s]*\+')

# ── Secret patterns ───────────────────────────────────────────────────────────

SECRET_ASSIGN_RE = re.compile(
    r'(?:const|let|var)\s+(\w*(?:password|passwd|secret|api_?key|token|private_?key|auth|credential)\w*)\s*=\s*["\']([^"\']{8,})["\']',
    re.IGNORECASE
)

# Known safe SQL pattern: .query('...', [params])
PARAMETERIZED_RE = re.compile(r'\.\s*(?:query|execute)\s*\(\s*["\'][^"\']+["\'\s]*,\s*\[')


def _extract_snippet(lines: List[str], lineno: int) -> List[str]:
    start = max(0, lineno - 1 - SNIPPET_CONTEXT)
    end   = min(len(lines), lineno + SNIPPET_CONTEXT)
    return lines[start:end]


def _make_finding(rule_id, type_, severity, confidence, file_path,
                  lineno, source_name, sink_name, data_flow, description,
                  remediation, snippet=None, is_secret=False, **extra):
    f = {
        'rule_id':     rule_id,
        'type':        type_,
        'severity':    severity,
        'confidence':  confidence,
        'file':        file_path,
        'line':        lineno,
        'col':         0,
        'source':      source_name,
        'sink':        sink_name,
        'data_flow':   data_flow,
        'description': description,
        'remediation': remediation,
        'snippet':     snippet,
        'status':      'OPEN',
        'language':    'javascript',
        'is_secret':   is_secret,
    }
    f.update(extra)
    return f


def analyze_file(file_path: str) -> List[dict]:
    """
    Pattern-based analysis of JavaScript/TypeScript files.
    NOTE: This is not a full AST analyzer. Accuracy is lower than the Python analyzer.
    Results should be treated as MEDIUM confidence.
    """
    try:
        size = os.path.getsize(file_path)
        if size > MAX_FILE_SIZE:
            log.warning(f"Skipping oversized JS file: {file_path} ({size // 1024}KB)")
            return [{'status': 'SKIPPED', 'reason': 'RESOURCE_LIMIT', 'file': file_path}]

        with open(file_path, 'r', encoding='utf-8', errors='replace') as fh:
            content = fh.read()
            lines   = content.splitlines()

    except (PermissionError, OSError) as e:
        log.warning(f"Cannot read JS file {file_path}: {e}")
        return []

    findings = []
    tainted_vars: set = set()   # simplified taint tracking for JS

    # First pass: collect tainted variable names from source patterns
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if stripped.startswith('//') or stripped.startswith('*'):
            continue
        for pat, src_name, framework in JS_SOURCES:
            if pat.search(line):
                # Extract variable name from: const x = req.query.y
                assign_m = re.search(r'(?:const|let|var)\s+(\w+)\s*=', line)
                if assign_m:
                    tainted_vars.add(assign_m.group(1))
                # Also treat destructured: const { name } = req.query
                dest_m = re.search(r'(?:const|let|var)\s*\{([^}]+)\}\s*=', line)
                if dest_m:
                    for vname in re.findall(r'\b(\w+)\b', dest_m.group(1)):
                        tainted_vars.add(vname)

    # Second pass: check sinks
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if stripped.startswith('//') or stripped.startswith('*'):
            continue

        # SQL injection
        if SQL_SINK_RE.search(line):
            # Check if it's parameterized
            if PARAMETERIZED_RE.search(line):
                continue  # safe pattern

            # Check for string concatenation or template literal with tainted vars
            taint_hit = None
            if CONCAT_SQL.search(line):
                taint_hit = 'string_concatenation'
            elif TEMPLATE_TAINT.search(line):
                m = TEMPLATE_TAINT.search(line)
                expr = m.group(1).strip() if m else ''
                root = expr.split('.')[0].split('[')[0]
                if root in tainted_vars or any(src in expr for _, src, _ in JS_SOURCES):
                    taint_hit = f'template_literal:{expr}'

            if taint_hit:
                findings.append(_make_finding(
                    rule_id='SAGE-SQL-001',
                    type_='SQL_INJECTION',
                    severity='HIGH',
                    confidence='MEDIUM',
                    file_path=file_path,
                    lineno=i,
                    source_name='req.query/req.body',
                    sink_name='db.query()',
                    data_flow=[f'user_input → {taint_hit} → SQL sink'],
                    description=(
                        "Potential SQL injection: user-controlled input may reach a SQL "
                        "execution sink through string construction."
                    ),
                    remediation=(
                        "Use parameterized queries: db.query('SELECT ... WHERE id=?', [userId]). "
                        "Never concatenate user input into SQL strings."
                    ),
                    snippet=_extract_snippet(lines, i),
                ))

        # Command injection
        if CMD_SINK_RE.search(line):
            taint_hit = any(tv in line for tv in tainted_vars) or \
                        any(src in line for _, src, _ in JS_SOURCES)
            if taint_hit:
                findings.append(_make_finding(
                    rule_id='SAGE-CMD-001',
                    type_='COMMAND_INJECTION',
                    severity='HIGH',
                    confidence='MEDIUM',
                    file_path=file_path,
                    lineno=i,
                    source_name='user_input',
                    sink_name='exec/spawn',
                    data_flow=['user_input → command execution'],
                    description=(
                        "User-controlled input may reach a command execution sink. "
                        "This can allow arbitrary OS command execution."
                    ),
                    remediation=(
                        "Avoid exec() with user input. Use spawn() with an explicit argument list. "
                        "Validate and whitelist all command inputs."
                    ),
                    snippet=_extract_snippet(lines, i),
                ))

        # eval / new Function
        if EVAL_SINK_RE.search(line):
            taint_hit = any(tv in line for tv in tainted_vars) or \
                        any(src in line for _, src, _ in JS_SOURCES)
            confidence = 'MEDIUM' if taint_hit else 'LOW'
            findings.append(_make_finding(
                rule_id='SAGE-EVAL-001',
                type_='DANGEROUS_EVAL',
                severity='HIGH',
                confidence=confidence,
                file_path=file_path,
                lineno=i,
                source_name='dynamic',
                sink_name='eval/new Function',
                data_flow=['dynamic_input → eval()'],
                description=(
                    "eval() or new Function() with dynamic input can execute arbitrary JavaScript."
                ),
                remediation=(
                    "Avoid eval() and new Function() entirely. "
                    "Use JSON.parse() for data parsing."
                ),
                snippet=_extract_snippet(lines, i),
            ))

        # Hardcoded secrets
        m = SECRET_ASSIGN_RE.search(line)
        if m:
            var_name = m.group(1)
            val      = m.group(2)
            fingerprint = f"{val[:4]}...({len(val)} chars)"
            findings.append(_make_finding(
                rule_id='SAGE-SECRET-001',
                type_='HARDCODED_SECRET',
                severity='HIGH',
                confidence='MEDIUM',
                file_path=file_path,
                lineno=i,
                source_name=var_name,
                sink_name='hardcoded_value',
                data_flow=[f"{var_name} = <redacted>"],
                description=f"Potential hardcoded secret in variable {var_name!r}.",
                remediation=(
                    "Store secrets in environment variables (process.env.SECRET). "
                    "Never hardcode credentials in source code."
                ),
                snippet=_extract_snippet(lines, i),
                is_secret=True,
                redacted_value='********',
                fingerprint=fingerprint,
                secret_type=_classify_secret(var_name),
            ))

    log.debug(f"JS: analyzed {file_path} — {len(findings)} findings "
              f"(pattern-based, not full AST)")
    return findings


def _classify_secret(var_name: str) -> str:
    v = var_name.lower()
    if 'aws' in v:      return 'AWS credential'
    if 'stripe' in v:   return 'Payment credential'
    if 'api' in v:      return 'API key'
    if 'token' in v:    return 'Auth token'
    if 'password' in v or 'passwd' in v: return 'Password'
    return 'Credential'
