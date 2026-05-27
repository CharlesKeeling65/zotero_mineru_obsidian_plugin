"""
Evidence system for RAG service.

This module provides evidence pack and context expansion functionality.
"""

from .evidence_pack import (
    EvidencePack,
    EvidencePackBuilder,
    EvidencePackFormatter,
    create_evidence_pack,
    format_evidence_pack
)
from .context_expander import (
    ContextExpander,
    ContextWindow,
    create_context_window
)

__all__ = [
    "EvidencePack",
    "EvidencePackBuilder",
    "EvidencePackFormatter",
    "create_evidence_pack",
    "format_evidence_pack",
    "ContextExpander",
    "ContextWindow",
    "create_context_window"
]