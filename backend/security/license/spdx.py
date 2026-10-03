"""
security/license/spdx.py
SPDX license identifier normalization.
Maps common license strings to their canonical SPDX identifiers.
Reference: https://spdx.org/licenses/
"""

# Canonical SPDX → common aliases mapping
SPDX_ALIASES: dict = {
    'MIT': [
        'mit', 'mit license', 'mit licence', 'the mit license',
        'mit/x11', 'x11',
    ],
    'Apache-2.0': [
        'apache-2.0', 'apache 2.0', 'apache2', 'apache 2',
        'apache license 2.0', 'apache license, version 2.0',
        'the apache software license, version 2.0',
        'apache software license 2.0',
    ],
    'GPL-3.0-only': [
        'gpl-3.0', 'gpl3', 'gpl-3', 'gpl 3.0', 'gpl v3',
        'gnu general public license v3.0',
        'gnu general public license, version 3',
        'gplv3',
    ],
    'GPL-2.0-only': [
        'gpl-2.0', 'gpl2', 'gpl-2', 'gpl 2.0', 'gpl v2',
        'gnu general public license v2.0',
        'gnu general public license, version 2',
        'gplv2',
    ],
    'LGPL-2.1-only': [
        'lgpl-2.1', 'lgpl 2.1', 'lgpl2.1', 'lgplv2.1',
        'gnu lesser general public license v2.1',
        'gnu lesser general public license, version 2.1',
    ],
    'LGPL-3.0-only': [
        'lgpl-3.0', 'lgpl 3.0', 'lgpl3', 'lgplv3',
        'gnu lesser general public license v3.0',
    ],
    'BSD-2-Clause': [
        'bsd-2-clause', 'bsd 2-clause', 'simplified bsd',
        'freebsd license', 'bsd2',
    ],
    'BSD-3-Clause': [
        'bsd-3-clause', 'bsd 3-clause', 'new bsd',
        'modified bsd', 'bsd3', 'bsd new',
        'the bsd license',
    ],
    'ISC': [
        'isc', 'isc license', 'the isc license',
    ],
    'MPL-2.0': [
        'mpl-2.0', 'mpl 2.0', 'mozilla public license 2.0',
        'mozilla public license, version 2.0',
    ],
    'AGPL-3.0-only': [
        'agpl-3.0', 'agpl3', 'agpl 3.0',
        'gnu affero general public license v3.0',
        'gnu affero gpl v3',
    ],
    'Unlicense': [
        'unlicense', 'the unlicense', 'public domain',
    ],
    'CC0-1.0': [
        'cc0-1.0', 'cc0', 'creative commons zero',
        'creative commons cc0 1.0 universal',
    ],
    'EUPL-1.2': [
        'eupl-1.2', 'eupl 1.2', 'european union public license 1.2',
    ],
    'WTFPL': [
        'wtfpl', 'do what the fuck you want to public license',
    ],
}

# Build reverse lookup: alias (lowercased) -> SPDX id
_REVERSE: dict = {}
for spdx_id, aliases in SPDX_ALIASES.items():
    _REVERSE[spdx_id.lower()] = spdx_id
    for alias in aliases:
        _REVERSE[alias.lower()] = spdx_id


def normalize(raw_license: str) -> str:
    """
    Normalize a raw license string to its SPDX identifier.
    Returns the SPDX id if recognized, otherwise returns the original string.
    """
    if not raw_license:
        return 'UNKNOWN'
    stripped = raw_license.strip()
    hit = _REVERSE.get(stripped.lower())
    if hit:
        return hit
    # Try without punctuation
    cleaned = stripped.lower().replace(',', '').replace('.', '').replace('-', ' ')
    hit = _REVERSE.get(cleaned)
    if hit:
        return hit
    # Check if it's already a valid SPDX id
    if stripped in SPDX_ALIASES:
        return stripped
    return stripped   # return original if not recognized


def is_copyleft(spdx_id: str) -> bool:
    """Return True if the license is copyleft (strong or weak)."""
    copyleft = {
        'GPL-2.0-only', 'GPL-2.0-or-later', 'GPL-3.0-only', 'GPL-3.0-or-later',
        'LGPL-2.0-only', 'LGPL-2.1-only', 'LGPL-3.0-only',
        'AGPL-3.0-only', 'AGPL-3.0-or-later',
        'MPL-2.0', 'EUPL-1.2',
    }
    return spdx_id in copyleft


def is_permissive(spdx_id: str) -> bool:
    """Return True if the license is permissive."""
    permissive = {
        'MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause',
        'ISC', 'Unlicense', 'CC0-1.0', 'WTFPL', '0BSD',
    }
    return spdx_id in permissive
