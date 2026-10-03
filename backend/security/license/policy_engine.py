"""
security/license/policy_engine.py
License policy evaluation engine.
Produces PASS / REVIEW / CONFLICT / UNKNOWN — not legal advice.
Does NOT use simplistic "GPL = BAD" rules.
Evaluates license compatibility based on project usage context.
"""
import logging
from .spdx import is_copyleft, is_permissive

log = logging.getLogger(__name__)

# Status values
PASS     = 'PASS'
REVIEW   = 'REVIEW'
CONFLICT = 'CONFLICT'
UNKNOWN  = 'UNKNOWN'

# Usage contexts
USAGE_CONTEXTS = [
    'internal',
    'commercial_closed_source',
    'open_source',
    'saas',
    'distributed',
]


def evaluate_license(dep_spdx: str, project_spdx: str,
                     usage_context: str) -> dict:
    """
    Evaluate license compatibility for a single dependency.

    Returns:
        {
            'status': PASS|REVIEW|CONFLICT|UNKNOWN,
            'reason': str,
        }
    """
    dep_spdx     = dep_spdx or 'UNKNOWN'
    project_spdx = project_spdx or 'UNKNOWN'
    usage        = (usage_context or 'unknown').lower()

    # Unknown dependency license → always REVIEW
    if dep_spdx in ('UNKNOWN', 'CONFLICT', ''):
        return {
            'status': UNKNOWN,
            'reason': (
                f"Dependency license could not be determined. "
                f"Review manually before including in {usage} project."
            ),
        }

    # Permissive licenses are generally safe in most contexts
    if is_permissive(dep_spdx):
        return {
            'status': PASS,
            'reason': (
                f"{dep_spdx} is a permissive license compatible with most use cases "
                f"including {usage} projects."
            ),
        }

    # AGPL: very strong copyleft — SaaS is explicitly impacted
    if dep_spdx in ('AGPL-3.0-only', 'AGPL-3.0-or-later'):
        if usage in ('saas', 'commercial_closed_source', 'distributed'):
            return {
                'status': REVIEW,
                'reason': (
                    f"AGPL-3.0 requires that the complete source code of the application "
                    f"be made available to users who interact with it over a network. "
                    f"For {usage} projects this may impose significant obligations. "
                    f"This is a governance signal — consult legal counsel."
                ),
            }
        if usage == 'open_source':
            return {
                'status': PASS if project_spdx == 'AGPL-3.0-only' else REVIEW,
                'reason': (
                    f"AGPL-3.0 is compatible with open source projects under AGPL-3.0. "
                    f"If your project uses a different license, review compatibility."
                ),
            }

    # GPL-3.0: strong copyleft
    if dep_spdx in ('GPL-3.0-only', 'GPL-3.0-or-later'):
        if usage in ('commercial_closed_source', 'distributed'):
            return {
                'status': REVIEW,
                'reason': (
                    f"GPL-3.0 requires that derivative works be distributed under GPL-3.0. "
                    f"For {usage} projects that distribute the software, this may require "
                    f"releasing your source code. Consult legal counsel."
                ),
            }
        if usage == 'saas':
            return {
                'status': PASS,
                'reason': (
                    f"GPL-3.0 does not impose network-use obligations (unlike AGPL). "
                    f"SaaS use is generally not considered distribution. Review if you distribute builds."
                ),
            }
        if usage == 'internal':
            return {
                'status': PASS,
                'reason': (
                    f"GPL-3.0 allows internal use. Obligations arise upon distribution."
                ),
            }

    # GPL-2.0: strong copyleft, similar to GPL-3.0
    if dep_spdx in ('GPL-2.0-only', 'GPL-2.0-or-later'):
        if usage in ('commercial_closed_source', 'distributed'):
            return {
                'status': REVIEW,
                'reason': (
                    f"GPL-2.0 requires source disclosure upon distribution of derivative works. "
                    f"Consult legal counsel for {usage} use."
                ),
            }
        return {
            'status': PASS,
            'reason': f"GPL-2.0 for {usage} use — obligations arise upon distribution.",
        }

    # LGPL: weak copyleft — usually OK if dynamically linked
    if dep_spdx in ('LGPL-2.1-only', 'LGPL-2.1-or-later',
                    'LGPL-3.0-only', 'LGPL-3.0-or-later'):
        return {
            'status': REVIEW,
            'reason': (
                f"{dep_spdx} imposes obligations when modifying the library itself. "
                f"Dynamic linking is generally permitted. "
                f"Verify your use does not require static linking or modification. "
                f"This is a governance signal — not legal advice."
            ),
        }

    # MPL-2.0: file-level copyleft
    if dep_spdx == 'MPL-2.0':
        return {
            'status': REVIEW,
            'reason': (
                f"MPL-2.0 requires that modifications to MPL-licensed files be "
                f"released under MPL-2.0. Your own files remain under your license. "
                f"Governance signal — review file-level modifications."
            ),
        }

    # Unrecognized SPDX
    return {
        'status': UNKNOWN,
        'reason': (
            f"License {dep_spdx!r} is not recognized in the SAGE policy registry. "
            f"Manual review required."
        ),
    }


def run_license_policy(dep_license_results: list, project_license: str,
                       usage_context: str, transaction_id: str) -> list:
    """
    Run the policy engine over all dependency license results.
    Returns a list of license finding dicts for the snapshot.
    """
    findings = []
    for dep in dep_license_results:
        dep_spdx    = dep.get('license_spdx', 'UNKNOWN')
        policy      = evaluate_license(dep_spdx, project_license, usage_context)

        finding = {
            'transaction_id': transaction_id,
            'dependency':     dep.get('dependency'),
            'dep_version':    dep.get('version'),
            'license_raw':    dep.get('license_raw', 'UNKNOWN'),
            'license_spdx':   dep_spdx,
            'project_license': project_license,
            'usage_context':  usage_context,
            'status':         policy['status'],
            'reason':         policy['reason'],
            'source':         dep.get('source', 'registry'),
            'confidence':     dep.get('confidence', 'LOW'),
        }
        findings.append(finding)

    # Summary counts
    counts = {PASS: 0, REVIEW: 0, CONFLICT: 0, UNKNOWN: 0}
    for f in findings:
        counts[f['status']] = counts.get(f['status'], 0) + 1

    log.info(
        f"License policy: {counts[PASS]} PASS, {counts[REVIEW]} REVIEW, "
        f"{counts[CONFLICT]} CONFLICT, {counts[UNKNOWN]} UNKNOWN"
    )
    return findings
