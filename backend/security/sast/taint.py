"""
security/sast/taint.py
Lightweight taint tracking for intra-file and basic inter-procedural analysis.
Represents tainted variables and tracks propagation through assignments,
string operations, and function calls.
"""
from dataclasses import dataclass, field
from typing import List, Optional, Dict


@dataclass
class TaintSource:
    name: str          # e.g. "request.args"
    framework: str     # e.g. "flask" | "express"
    description: str


@dataclass
class TaintedVar:
    name: str
    source: TaintSource
    source_location: str    # "file:line"
    propagation_path: List[str] = field(default_factory=list)

    def extend(self, new_name: str, location: str) -> 'TaintedVar':
        """Return a new TaintedVar representing taint flowing into new_name."""
        return TaintedVar(
            name=new_name,
            source=self.source,
            source_location=self.source_location,
            propagation_path=self.propagation_path + [f"{self.name} → {new_name} at {location}"],
        )


class TaintState:
    """
    Tracks tainted variables within a single analysis scope (function/file).
    """
    def __init__(self):
        self._tainted: Dict[str, TaintedVar] = {}

    def mark_tainted(self, var_name: str, tainted_var: TaintedVar):
        self._tainted[var_name] = tainted_var

    def is_tainted(self, var_name: str) -> bool:
        return var_name in self._tainted

    def get_taint(self, var_name: str) -> Optional[TaintedVar]:
        return self._tainted.get(var_name)

    def propagate(self, from_var: str, to_var: str, location: str) -> bool:
        """Propagate taint from from_var to to_var. Returns True if taint spread."""
        tv = self._tainted.get(from_var)
        if tv:
            self._tainted[to_var] = tv.extend(to_var, location)
            return True
        return False

    def any_tainted(self, var_names: List[str]) -> Optional[TaintedVar]:
        """Return first tainted var from a list (for multi-arg sinks)."""
        for name in var_names:
            tv = self._tainted.get(name)
            if tv:
                return tv
        return None

    def merge(self, other: 'TaintState'):
        """Merge another TaintState into this one (for branch analysis)."""
        self._tainted.update(other._tainted)


# ── Registered Sources ────────────────────────────────────────────────────────

PYTHON_SOURCES = [
    TaintSource("request.args",      "flask", "Flask request query parameters"),
    TaintSource("request.form",      "flask", "Flask request form data"),
    TaintSource("request.json",      "flask", "Flask request JSON body"),
    TaintSource("request.data",      "flask", "Flask raw request data"),
    TaintSource("request.get_json",  "flask", "Flask JSON body via get_json()"),
    TaintSource("request.values",    "flask", "Flask combined GET+POST values"),
    TaintSource("request.cookies",   "flask", "Flask request cookies"),
    TaintSource("request.headers",   "flask", "Flask request headers"),
    TaintSource("sys.argv",          "stdlib","Command-line arguments"),
    TaintSource("os.environ",        "stdlib","Environment variables"),
    TaintSource("input",             "stdlib","User input via input()"),
]

JAVASCRIPT_SOURCES = [
    TaintSource("req.query",  "express", "Express request query params"),
    TaintSource("req.body",   "express", "Express request body"),
    TaintSource("req.params", "express", "Express route params"),
    TaintSource("req.headers","express", "Express request headers"),
    TaintSource("req.cookies","express", "Express cookies"),
]

PYTHON_SOURCE_NAMES  = {s.name for s in PYTHON_SOURCES}
JS_SOURCE_NAMES      = {s.name for s in JAVASCRIPT_SOURCES}


def get_source(name: str, lang: str) -> Optional[TaintSource]:
    pool = PYTHON_SOURCES if lang == 'python' else JAVASCRIPT_SOURCES
    for s in pool:
        if s.name == name or name.startswith(s.name):
            return s
    return None
