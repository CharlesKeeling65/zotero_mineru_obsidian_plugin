"""
Evidence Pack System for RAG Service

This module provides evidence pack functionality for creating structured
evidence collections from search results, including citations and context.
"""

import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


class EvidencePack:
    """Evidence pack for structured evidence collection."""
    
    def __init__(
        self,
        query: str,
        results: List[Dict[str, Any]],
        metadata: Optional[Dict[str, Any]] = None
    ):
        """Initialize evidence pack."""
        self.query = query
        self.results = results
        self.metadata = metadata or {}
        self.created_at = datetime.now().isoformat()
        
        # Calculate confidence
        self.confidence = self._calculate_confidence()
        
        # Create evidence items
        self.evidence_items = self._create_evidence_items()
    
    def _calculate_confidence(self) -> str:
        """Calculate confidence level based on results."""
        if not self.results:
            return "low"
        
        # Check average score
        scores = [r.get("score", 0) for r in self.results]
        avg_score = sum(scores) / len(scores) if scores else 0
        
        # Check number of results
        result_count = len(self.results)
        
        # Confidence logic
        if avg_score >= 0.8 and result_count >= 3:
            return "high"
        elif avg_score >= 0.6 and result_count >= 2:
            return "medium"
        else:
            return "low"
    
    def _create_evidence_items(self) -> List[Dict[str, Any]]:
        """Create evidence items from results."""
        evidence_items = []
        
        for i, result in enumerate(self.results):
            # Extract metadata
            metadata = result.get("metadata", {})
            
            # Create evidence item
            evidence_item = {
                "id": f"evidence_{i+1:03d}",
                "chunk_id": result.get("chunk_id"),
                "item_key": result.get("item_key"),
                "block_id": result.get("block_id"),
                "title": result.get("title", ""),
                "section": result.get("section", ""),
                "page": result.get("page", 0),
                "text": result.get("text", ""),
                "score": result.get("score", 0),
                "retrieval_source": result.get("retrieval_source", {}),
                "context": result.get("context", {}),
                "citation": self._create_citation(result),
                "why_relevant": self._explain_relevance(result)
            }
            
            evidence_items.append(evidence_item)
        
        return evidence_items
    
    def _create_citation(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """Create citation for a result."""
        return {
            "item_key": result.get("item_key"),
            "title": result.get("title", ""),
            "authors": result.get("authors", []),
            "year": result.get("year"),
            "doi": result.get("doi"),
            "section": result.get("section", ""),
            "page": result.get("page", 0),
            "zotero_select_uri": f"zotero://select/items/{result.get('item_key')}"
        }
    
    def _explain_relevance(self, result: Dict[str, Any]) -> str:
        """Explain why a result is relevant."""
        # Simple relevance explanation based on score and content
        score = result.get("score", 0)
        section = result.get("section", "")
        
        if score >= 0.8:
            return f"Highly relevant passage from {section} section"
        elif score >= 0.6:
            return f"Relevant passage from {section} section"
        else:
            return f"Potentially relevant passage from {section} section"
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert evidence pack to dictionary."""
        return {
            "query": self.query,
            "evidence_items": self.evidence_items,
            "total": len(self.evidence_items),
            "confidence": self.confidence,
            "created_at": self.created_at,
            "metadata": self.metadata
        }
    
    def to_json(self, indent: int = 2) -> str:
        """Convert evidence pack to JSON string."""
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=indent)
    
    def get_citations(self) -> List[Dict[str, Any]]:
        """Get list of citations."""
        return [item["citation"] for item in self.evidence_items]
    
    def get_evidence_texts(self) -> List[str]:
        """Get list of evidence texts."""
        return [item["text"] for item in self.evidence_items]
    
    def get_evidence_by_item(self, item_key: str) -> List[Dict[str, Any]]:
        """Get evidence items for a specific item."""
        return [item for item in self.evidence_items if item["item_key"] == item_key]
    
    def get_evidence_by_section(self, section: str) -> List[Dict[str, Any]]:
        """Get evidence items for a specific section."""
        return [item for item in self.evidence_items if item["section"] == section]
    
    def get_top_evidence(self, n: int = 5) -> List[Dict[str, Any]]:
        """Get top N evidence items by score."""
        sorted_items = sorted(
            self.evidence_items,
            key=lambda x: x["score"],
            reverse=True
        )
        return sorted_items[:n]


class EvidencePackBuilder:
    """Builder for creating evidence packs."""
    
    def __init__(self, query: str):
        """Initialize builder with query."""
        self.query = query
        self.results = []
        self.metadata = {}
    
    def add_result(self, result: Dict[str, Any]) -> 'EvidencePackBuilder':
        """Add a search result."""
        self.results.append(result)
        return self
    
    def add_results(self, results: List[Dict[str, Any]]) -> 'EvidencePackBuilder':
        """Add multiple search results."""
        self.results.extend(results)
        return self
    
    def set_metadata(self, key: str, value: Any) -> 'EvidencePackBuilder':
        """Set metadata."""
        self.metadata[key] = value
        return self
    
    def build(self) -> EvidencePack:
        """Build evidence pack."""
        return EvidencePack(
            query=self.query,
            results=self.results,
            metadata=self.metadata
        )


class EvidencePackFormatter:
    """Formatter for evidence packs."""
    
    @staticmethod
    def to_markdown(evidence_pack: EvidencePack) -> str:
        """Format evidence pack as markdown."""
        lines = []
        
        # Header
        lines.append(f"# Evidence Pack")
        lines.append(f"")
        lines.append(f"**Query:** {evidence_pack.query}")
        lines.append(f"**Confidence:** {evidence_pack.confidence}")
        lines.append(f"**Total Evidence:** {len(evidence_pack.evidence_items)}")
        lines.append(f"**Created:** {evidence_pack.created_at}")
        lines.append(f"")
        
        # Evidence items
        lines.append(f"## Evidence Items")
        lines.append(f"")
        
        for i, item in enumerate(evidence_pack.evidence_items):
            lines.append(f"### Evidence {i+1}")
            lines.append(f"")
            lines.append(f"**Source:** {item['title']}")
            lines.append(f"**Section:** {item['section']}")
            lines.append(f"**Page:** {item['page']}")
            lines.append(f"**Score:** {item['score']:.2f}")
            lines.append(f"")
            lines.append(f"**Text:**")
            lines.append(f"```")
            lines.append(item['text'])
            lines.append(f"```")
            lines.append(f"")
            
            # Context
            context = item.get('context', {})
            if context:
                lines.append(f"**Context:**")
                if context.get('before'):
                    lines.append(f"- Before: {context['before'][:100]}...")
                if context.get('after'):
                    lines.append(f"- After: {context['after'][:100]}...")
                lines.append(f"")
            
            # Citation
            citation = item.get('citation', {})
            if citation:
                lines.append(f"**Citation:**")
                lines.append(f"- Item Key: {citation.get('item_key')}")
                if citation.get('doi'):
                    lines.append(f"- DOI: {citation['doi']}")
                lines.append(f"")
            
            lines.append(f"---")
            lines.append(f"")
        
        return "\n".join(lines)
    
    @staticmethod
    def to_text(evidence_pack: EvidencePack) -> str:
        """Format evidence pack as plain text."""
        lines = []
        
        lines.append(f"Evidence Pack")
        lines.append(f"=============")
        lines.append(f"Query: {evidence_pack.query}")
        lines.append(f"Confidence: {evidence_pack.confidence}")
        lines.append(f"Total Evidence: {len(evidence_pack.evidence_items)}")
        lines.append(f"")
        
        for i, item in enumerate(evidence_pack.evidence_items):
            lines.append(f"Evidence {i+1}:")
            lines.append(f"  Source: {item['title']}")
            lines.append(f"  Section: {item['section']}")
            lines.append(f"  Page: {item['page']}")
            lines.append(f"  Score: {item['score']:.2f}")
            lines.append(f"  Text: {item['text'][:200]}...")
            lines.append(f"")
        
        return "\n".join(lines)


def create_evidence_pack(
    query: str,
    results: List[Dict[str, Any]],
    metadata: Optional[Dict[str, Any]] = None
) -> EvidencePack:
    """Create an evidence pack from search results."""
    return EvidencePack(query=query, results=results, metadata=metadata)


def format_evidence_pack(
    evidence_pack: EvidencePack,
    format: str = "json"
) -> str:
    """Format evidence pack in specified format."""
    if format == "json":
        return evidence_pack.to_json()
    elif format == "markdown":
        return EvidencePackFormatter.to_markdown(evidence_pack)
    elif format == "text":
        return EvidencePackFormatter.to_text(evidence_pack)
    else:
        raise ValueError(f"Unsupported format: {format}")