"""FastAPI application — 69码查询器 backend (with login & permission system)."""

from __future__ import annotations
import os
from typing import List

import pandas as pd
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Body
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import or_
from database import engine, MasterBase
from models import Product, User
from schemas import (
    ApiResponse,
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    PageData,
    BatchQueryRequest,
    BatchQueryItem,
    ImportPreview,
    ColumnMatchResponse,
    ColumnMatchResult,
    ImportConfirmRequest,
    ImportResult,
    SkipDetail,
    ColumnConfigUpdateRequest,
    DeduplicateResult,
    AddSemanticRequest,
)
from crud import (
    get_products,
    get_product_by_code,
    get_products_by_codes,
    create_product,
    update_product,
    delete_product,
    delete_products,
    bulk_import,
    get_duplicate_codes,
    get_duplicate_products,
    deduplicate_products,
    get_all_semantic_mappings,
    add_semantic_mapping,
    get_column_configs,
    update_column_configs,
)
from matcher import match_columns
from config import UPLOAD_DIR
from deps import get_company_db as get_biz_db, get_current_user
from routers import auth, invites, users
from init_auth import init_auth_system

# ── App Setup ─────────────────────────────────────────────────────

app = FastAPI(title="69码查询器 API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5178"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(invites.router)
app.include_router(users.router)


@app.on_event("startup")
def on_startup():
    # 系统表（主库）自动建表 + 初始化最高级管理员/默认公司/旧数据迁移
    MasterBase.metadata.create_all(bind=engine)
    init_auth_system()


# ── Helper ────────────────────────────────────────────────────────

def _company_upload_dir(user: User) -> str:
    """Per-company upload directory to avoid cross-company filename clashes."""
    path = os.path.join(UPLOAD_DIR, f"company_{user.company_id}")
    os.makedirs(path, exist_ok=True)
    return path


def _product_to_response(p: Product) -> ProductResponse:
    return ProductResponse(
        id=p.id,
        model=p.model or "",
        name=p.name or "",
        code=p.code or "",
        source=p.source or "",
        remark=p.remark or "",
        created_at=p.created_at.isoformat() if p.created_at else "",
        updated_at=p.updated_at.isoformat() if p.updated_at else "",
    )


# ── Query APIs ────────────────────────────────────────────────────

@app.get("/api/query/single")
def query_single(code: str, db: Session = Depends(get_biz_db)):
    product = get_product_by_code(db, code.strip())
    if not product:
        return ApiResponse(success=True, data=None, message="未找到该69码")
    return ApiResponse(success=True, data=_product_to_response(product))


@app.get("/api/query/fuzzy")
def query_fuzzy(q: str = "", db: Session = Depends(get_biz_db)):
    """Fuzzy search across code, model, name, and source."""
    if not q.strip():
        return ApiResponse(success=True, data=[])
    like = f"%{q.strip()}%"
    products = (
        db.query(Product)
        .filter(
            or_(
                Product.code.like(like),
                Product.model.like(like),
                Product.name.like(like),
                Product.source.like(like),
            )
        )
        .order_by(Product.id.asc())
        .all()
    )
    return ApiResponse(success=True, data=[_product_to_response(p) for p in products])


@app.post("/api/query/batch", response_model=ApiResponse)
def query_batch(req: BatchQueryRequest, db: Session = Depends(get_biz_db)):
    clean_codes = [c.strip() for c in req.codes if c.strip()]
    found_products = get_products_by_codes(db, clean_codes)
    found_map = {p.code: p for p in found_products}

    results = []
    for code in clean_codes:
        p = found_map.get(code)
        results.append(
            BatchQueryItem(
                code=code,
                found=p is not None,
                row=_product_to_response(p) if p else None,
            )
        )
    return ApiResponse(success=True, data=[r.model_dump() for r in results])


@app.post("/api/query/export")
def query_export(req: BatchQueryRequest, db: Session = Depends(get_biz_db)):
    """Export query results as Excel file (returned as JSON; frontend generates file)."""
    clean_codes = [c.strip() for c in req.codes if c.strip()]
    found_products = get_products_by_codes(db, clean_codes)
    found_map = {p.code: p for p in found_products}

    results = []
    for code in clean_codes:
        p = found_map.get(code)
        if p:
            results.append(_product_to_response(p).model_dump())
        else:
            results.append({"code": code, "model": "", "name": "", "source": "", "remark": "", "created_at": "", "updated_at": ""})

    return ApiResponse(success=True, data=results)


# ── Data Management APIs ──────────────────────────────────────────

@app.get("/api/data", response_model=ApiResponse)
def list_data(
    page: int = 1,
    page_size: int = 50,
    search: str = "",
    db: Session = Depends(get_biz_db),
):
    items, total = get_products(db, page=page, page_size=page_size, search=search)
    return ApiResponse(
        success=True,
        data=PageData(
            items=[_product_to_response(p) for p in items],
            total=total,
            page=page,
            page_size=page_size,
        ),
    )


@app.post("/api/data", response_model=ApiResponse)
def add_data(data: ProductCreate, db: Session = Depends(get_biz_db)):
    product = create_product(db, data)
    return ApiResponse(success=True, data=_product_to_response(product))


@app.put("/api/data/{product_id}", response_model=ApiResponse)
def edit_data(product_id: int, data: ProductUpdate, db: Session = Depends(get_biz_db)):
    product = update_product(db, product_id, data)
    if not product:
        raise HTTPException(status_code=404, detail="记录不存在")
    return ApiResponse(success=True, data=_product_to_response(product))


@app.delete("/api/data/{product_id}", response_model=ApiResponse)
def remove_data(product_id: int, db: Session = Depends(get_biz_db)):
    ok = delete_product(db, product_id)
    if not ok:
        raise HTTPException(status_code=404, detail="记录不存在")
    return ApiResponse(success=True, message="删除成功")


@app.post("/api/data/batch-delete", response_model=ApiResponse)
def batch_remove_data(ids: List[int] = Body(...), db: Session = Depends(get_biz_db)):
    if not ids:
        raise HTTPException(status_code=400, detail="ID列表不能为空")
    deleted = delete_products(db, ids)
    return ApiResponse(success=True, message=f"删除了 {deleted} 条记录")


# ── Deduplication ─────────────────────────────────────────────────

@app.get("/api/data/duplicates", response_model=ApiResponse)
def list_duplicates(db: Session = Depends(get_biz_db)):
    products = get_duplicate_products(db)
    return ApiResponse(
        success=True,
        data=[_product_to_response(p) for p in products],
    )


@app.get("/api/data/duplicate-codes", response_model=ApiResponse)
def list_duplicate_codes(db: Session = Depends(get_biz_db)):
    codes = get_duplicate_codes(db)
    return ApiResponse(success=True, data=codes)


@app.post("/api/data/deduplicate", response_model=ApiResponse)
def run_deduplicate(db: Session = Depends(get_biz_db)):
    deleted = deduplicate_products(db)
    return ApiResponse(
        success=True,
        data=DeduplicateResult(deleted_count=deleted),
        message=f"去重完成，删除了 {deleted} 条重复记录",
    )


# ── Import APIs ───────────────────────────────────────────────────

@app.post("/api/import/upload", response_model=ApiResponse)
def upload_file(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    """Upload a file, save to temp, parse and return preview data."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="文件名不能为空")

    # Sanitize filename to prevent path traversal
    safe_filename = os.path.basename(file.filename)
    if not safe_filename:
        raise HTTPException(status_code=400, detail="文件名无效")

    ext = os.path.splitext(safe_filename)[1].lower()
    if ext not in (".xlsx", ".xls", ".csv"):
        raise HTTPException(status_code=400, detail="仅支持 .xlsx / .xls / .csv 格式")

    save_path = os.path.join(_company_upload_dir(user), safe_filename)

    # Read content and save to disk
    content = file.file.read()
    with open(save_path, "wb") as f:
        f.write(content)
    file.file.close()

    try:
        if ext == ".csv":
            try:
                decoded = content.decode("utf-8")
            except UnicodeDecodeError:
                decoded = content.decode("gbk")
            import io
            df = pd.read_csv(io.StringIO(decoded))
        else:
            df = pd.read_excel(save_path)
    except Exception as e:
        # Clean up on parse failure
        try:
            os.remove(save_path)
        except OSError:
            pass
        raise HTTPException(status_code=400, detail=f"文件解析失败: {str(e)}")

    if df.empty:
        raise HTTPException(status_code=400, detail="文件为空")

    columns = list(df.columns)
    preview = df.head(5).fillna("").to_dict(orient="records")

    return ApiResponse(
        success=True,
        data=ImportPreview(
            filename=safe_filename,
            total_rows=len(df),
            columns=columns,
            preview_rows=preview,
        ),
    )


@app.post("/api/import/match-columns", response_model=ApiResponse)
def match_columns_api(data: dict, db: Session = Depends(get_biz_db)):
    """Match file columns to target fields (model/name/code)."""
    file_columns = data.get("columns", [])
    if not isinstance(file_columns, list) or not all(isinstance(c, str) for c in file_columns):
        raise HTTPException(status_code=400, detail="列名列表格式不正确")
    if not file_columns:
        raise HTTPException(status_code=400, detail="列名列表不能为空")

    mappings = get_all_semantic_mappings(db)
    semantic_data = [{"source_column": m.source_column, "target_field": m.target_field} for m in mappings]

    results, unmatched = match_columns(file_columns, semantic_data)

    return ApiResponse(
        success=True,
        data=ColumnMatchResponse(
            matches=[ColumnMatchResult(**r) for r in results],
            unmatched=unmatched,
        ),
    )


@app.post("/api/import/confirm", response_model=ApiResponse)
def confirm_import(
    req: ImportConfirmRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_biz_db),
):
    """Confirm import with user-specified column mapping."""
    safe_filename = os.path.basename(req.filename)
    ext = os.path.splitext(safe_filename)[1].lower()
    filepath = os.path.join(_company_upload_dir(user), safe_filename)

    if not os.path.exists(filepath):
        raise HTTPException(status_code=400, detail="文件不存在，请重新上传")

    try:
        if ext == ".csv":
            try:
                df = pd.read_csv(filepath)
            except UnicodeDecodeError:
                df = pd.read_csv(filepath, encoding="gbk")
        else:
            df = pd.read_excel(filepath)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"文件读取失败: {str(e)}")

    # Build column mapping: source_column -> target_field
    col_map = {}
    for target, source in req.column_mapping.items():
        if source:
            col_map[source] = target

    records = []
    for _, row in df.iterrows():
        rec = {}
        for source_col, target_field in col_map.items():
            val = row.get(source_col)
            if pd.isna(val):
                val = ""
            else:
                val = str(val).strip()
            rec[target_field] = val
        rec["code"] = rec.get("code", "")
        rec["model"] = rec.get("model", "")
        rec["name"] = rec.get("name", "")
        rec["source"] = safe_filename
        rec["remark"] = ""
        # Skip empty code
        if not rec["code"]:
            continue
        # Handle numeric codes read as floats (e.g. 6.90123e+12 → "6901234567890")
        try:
            if "." in rec["code"] and rec["code"].replace(".", "").replace("-", "").isdigit():
                f = float(rec["code"])
                if f == int(f):
                    rec["code"] = str(int(f))
        except (ValueError, TypeError):
            pass
        records.append(rec)

    imported, skipped, skip_details = bulk_import(db, records)

    # Optionally add to semantic library
    if req.add_to_semantic:
        for target, source in req.column_mapping.items():
            if source and target in ("model", "name", "code"):
                add_semantic_mapping(db, source, target)

    # Clean up temp file
    try:
        os.remove(filepath)
    except OSError:
        pass

    return ApiResponse(
        success=True,
        data=ImportResult(
            total=len(records),
            imported=imported,
            skipped=skipped,
            skip_details=[SkipDetail(**sd) for sd in skip_details],
        ),
        message=f"导入完成: 共 {len(records)} 条, 成功导入 {imported} 条, 跳过 {skipped} 条",
    )


@app.post("/api/import/upload-temp", response_model=ApiResponse)
def upload_temp(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    """Upload file to temp storage for later import confirmation."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="文件名不能为空")
    safe_filename = os.path.basename(file.filename)
    if not safe_filename:
        raise HTTPException(status_code=400, detail="文件名无效")
    ext = os.path.splitext(safe_filename)[1].lower()
    if ext not in (".xlsx", ".xls", ".csv"):
        raise HTTPException(status_code=400, detail="仅支持 .xlsx / .xls / .csv 格式")

    save_path = os.path.join(_company_upload_dir(user), safe_filename)
    content = file.file.read()
    with open(save_path, "wb") as f:
        f.write(content)
    file.file.close()

    return ApiResponse(success=True, data={"filename": safe_filename}, message="上传成功")


# ── Semantic Library APIs ─────────────────────────────────────────

@app.get("/api/semantic", response_model=ApiResponse)
def list_semantic(db: Session = Depends(get_biz_db)):
    mappings = get_all_semantic_mappings(db)
    return ApiResponse(success=True, data=[m.to_dict() for m in mappings])


@app.post("/api/semantic", response_model=ApiResponse)
def add_semantic(req: AddSemanticRequest, db: Session = Depends(get_biz_db)):
    mapping = add_semantic_mapping(db, req.source_column, req.target_field)
    return ApiResponse(success=True, data=mapping.to_dict(), message="语义库已更新")


# ── Column Config APIs ────────────────────────────────────────────

@app.get("/api/config/columns", response_model=ApiResponse)
def list_column_config(view_type: str = "data", db: Session = Depends(get_biz_db)):
    if view_type not in ("data", "query"):
        raise HTTPException(status_code=400, detail="view_type 必须是 data 或 query")
    configs = get_column_configs(db, view_type=view_type)
    return ApiResponse(success=True, data=[c.to_dict() for c in configs])


@app.put("/api/config/columns", response_model=ApiResponse)
def update_column_config(req: ColumnConfigUpdateRequest, db: Session = Depends(get_biz_db)):
    updated = update_column_configs(db, [c.model_dump() for c in req.columns])
    return ApiResponse(success=True, data=[c.to_dict() for c in updated], message="配置已保存")


# ── Run ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8005, reload=True)
