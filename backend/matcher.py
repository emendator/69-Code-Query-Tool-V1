"""Column matching engine: fuzzy + semantic matching."""

from __future__ import annotations
import difflib
from typing import Dict, List, Optional, Tuple

from config import MODEL_KEYWORDS, NAME_KEYWORDS, CODE_KEYWORDS


# Threshold for fuzzy matching
FUZZY_THRESHOLD = 0.6
HIGH_CONFIDENCE_THRESHOLD = 0.8

TARGET_FIELDS = ["model", "name", "code"]

# Static keyword map for built-in matching
KEYWORD_MAP: Dict[str, List[str]] = {
    "model": MODEL_KEYWORDS,
    "name": NAME_KEYWORDS,
    "code": CODE_KEYWORDS,
}


def normalize(s: str) -> str:
    """Lower-case and strip whitespace."""
    return s.strip().lower()


def fuzzy_match_column(column_name: str, keywords: List[str]) -> Tuple[Optional[str], float]:
    """Fuzzy match a column name against a list of keywords.

    Returns (best_keyword, similarity_ratio) or (None, 0).
    """
    col = normalize(column_name)
    best_keyword = None
    best_ratio = 0.0

    for kw in keywords:
        kw_norm = normalize(kw)

        # 1. Exact match
        if col == kw_norm:
            return kw, 1.0

        # 2. Contains
        if kw_norm in col or col in kw_norm:
            ratio = 0.9
            if ratio > best_ratio:
                best_ratio = ratio
                best_keyword = kw
            continue

        # 3. Sequence matcher
        ratio = difflib.SequenceMatcher(None, col, kw_norm).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            best_keyword = kw

    # Apply threshold
    if best_ratio >= FUZZY_THRESHOLD:
        return best_keyword, best_ratio
    return None, 0.0


def match_columns(
    file_columns: List[str],
    semantic_mappings: Optional[List[dict]] = None,
) -> Tuple[List[dict], List[str]]:
    """Main matching entry point.

    For each target field (model/name/code), find the best matching column
    from file_columns. Returns a list of match results with confidence.

    Args:
        file_columns: Column names from the uploaded file.
        semantic_mappings: List of {source_column, target_field} from DB.

    Returns:
        List of dicts with keys: target_field, source_column, confidence
    """
    if semantic_mappings is None:
        semantic_mappings = []

    # Build semantic lookup: source_column -> target_field
    semantic_lookup: Dict[str, str] = {}
    for m in semantic_mappings:
        semantic_lookup[normalize(m["source_column"])] = m["target_field"]

    results = []
    used_columns = set()

    for target in TARGET_FIELDS:
        best_col = None
        best_score = 0.0
        best_method = ""

        for col in file_columns:
            col_norm = normalize(col)
            if col_norm in used_columns:
                continue

            # ── Semantic matching (DB) ──
            sem_target = semantic_lookup.get(col_norm)
            if sem_target == target:
                score = 1.0
                if score > best_score:
                    best_col = col
                    best_score = score
                    best_method = "semantic"
                    continue

            # ── Built-in keyword matching ──
            _, fuzzy_score = fuzzy_match_column(col, KEYWORD_MAP[target])
            if fuzzy_score > best_score:
                best_col = col
                best_score = fuzzy_score
                best_method = "builtin"

        if best_col and best_score >= FUZZY_THRESHOLD:
            if best_score >= HIGH_CONFIDENCE_THRESHOLD:
                confidence = "high"
            else:
                confidence = "medium"
            results.append({
                "target_field": target,
                "source_column": best_col,
                "confidence": confidence,
            })
            used_columns.add(normalize(best_col))
        else:
            results.append({
                "target_field": target,
                "source_column": "",
                "confidence": "low",
            })

    # Find truly unmatched columns (not matched to any target)
    matched_cols = {normalize(r["source_column"]) for r in results if r["source_column"]}
    unmatched = [c for c in file_columns if normalize(c) not in matched_cols]

    return results, unmatched
