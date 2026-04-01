#!/usr/bin/env python3
"""
Image Transformer Service - Processa imagens antes do upload
Serviço rodando em localhost:5000 que:
- Recebe base64 de imagem
- Processa (redimensiona, normaliza, valida)
- Salva cópia em cache local
- Retorna base64 processado
"""

from flask import Flask, request, jsonify
from PIL import Image
import base64
import os
import json
from pathlib import Path
from datetime import datetime
import traceback

app = Flask(__name__)

# Configuração
CACHE_DIR = Path(__file__).parent.parent / "cache" / "images"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Logging simplificado
def log(message: str, level: str = "INFO"):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] [{level}] {message}")


@app.route('/health', methods=['GET'])
def health():
    """Healthcheck endpoint para Node.js saber se Python está rodando"""
    return jsonify({"status": "ok", "service": "image_transformer"})


@app.route('/process', methods=['POST'])
def process_image():
    """
    POST /process

    Input:
      {
        "base64": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
        "filename": "main_generation_xyz.jpg"
      }

    Output:
      {
        "status": "success",
        "base64": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
        "filename": "main_generation_xyz_processed.jpg",
        "cached_path": "/cache/images/main_generation_xyz.jpg",
        "size": 123456,
        "original_size": 654321,
        "dimensions": "1024x768",
        "mime_type": "image/jpeg"
      }
    """
    try:
        data = request.get_json()

        if not data or 'base64' not in data:
            return jsonify({"status": "error", "message": "Missing base64 in request"}), 400

        base64_str = data['base64']
        filename = data.get('filename', f'image_{int(datetime.now().timestamp())}.jpg')

        log(f"Processing image: {filename}")

        # ============================================
        # ETAPA 1: Decodificar base64
        # ============================================
        try:
            # Remove header "data:image/...;base64," se existir
            if ',' in base64_str:
                base64_str = base64_str.split(',')[1]

            image_data = base64.b64decode(base64_str)
            log(f"Decoded base64: {len(image_data)} bytes")
        except Exception as e:
            return jsonify({"status": "error", "message": f"Invalid base64: {str(e)}"}), 400

        # ============================================
        # ETAPA 2: Abrir imagem com PIL
        # ============================================
        try:
            # Salva dados em arquivo temporário
            import io
            image = Image.open(io.BytesIO(image_data))
            original_size = len(image_data)
            original_dims = f"{image.width}x{image.height}"
            log(f"Image opened: {original_dims}, {original_size} bytes")
        except Exception as e:
            return jsonify({"status": "error", "message": f"Invalid image: {str(e)}"}), 400

        # ============================================
        # ETAPA 3: Processar imagem
        # ============================================
        try:
            # Redimensiona se > 2048px (para não ir muito grande)
            max_size = 2048
            if image.width > max_size or image.height > max_size:
                image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
                log(f"Resized to: {image.width}x{image.height}")

            # Normaliza para RGB (remove alpha, converte CMYK, etc)
            if image.mode != 'RGB':
                image = image.convert('RGB')
                log(f"Converted mode to RGB")

            # Remove EXIF (privacidade)
            data = list(image.getdata())
            image_without_exif = Image.new(image.mode, image.size)
            image_without_exif.putdata(data)
            image = image_without_exif
            log(f"Removed EXIF data")

            processed_dims = f"{image.width}x{image.height}"
        except Exception as e:
            return jsonify({"status": "error", "message": f"Processing failed: {str(e)}"}), 500

        # ============================================
        # ETAPA 4: Salvar em cache local
        # ============================================
        try:
            # Salva JPEG comprimido em /cache/images/
            cache_filename = filename.rsplit('.', 1)[0] + '.jpg'
            cache_path = CACHE_DIR / cache_filename

            # Salva com qualidade 85 (bom balanço entre tamanho e qualidade)
            image.save(cache_path, 'JPEG', quality=85, optimize=True)
            log(f"Cached to: {cache_path}")
        except Exception as e:
            log(f"Cache save failed (não-crítico): {str(e)}", "WARN")
            cache_path = None

        # ============================================
        # ETAPA 5: Gerar base64 processado
        # ============================================
        try:
            import io
            buffer = io.BytesIO()
            image.save(buffer, format='JPEG', quality=85, optimize=True)
            processed_image_data = buffer.getvalue()

            processed_base64 = base64.b64encode(processed_image_data).decode()
            processed_size = len(processed_image_data)

            # Cria data URL
            data_url = f"data:image/jpeg;base64,{processed_base64}"

            log(f"Processed: {processed_size} bytes (original: {original_size})")
            log(f"Compression: {round(100 - (processed_size/original_size)*100, 1)}%")
        except Exception as e:
            return jsonify({"status": "error", "message": f"Base64 encoding failed: {str(e)}"}), 500

        # ============================================
        # ETAPA 6: Validar base64 resultante
        # ============================================
        try:
            test_decode = base64.b64decode(processed_base64)
            if len(test_decode) == 0:
                raise Exception("Base64 decodificado é vazio")
            log(f"Base64 validation: OK")
        except Exception as e:
            return jsonify({"status": "error", "message": f"Base64 validation failed: {str(e)}"}), 500

        # ============================================
        # Retorno bem-sucedido
        # ============================================
        response = {
            "status": "success",
            "base64": data_url,
            "filename": cache_filename,
            "cached_path": str(cache_path) if cache_path else None,
            "size": processed_size,
            "original_size": original_size,
            "dimensions": processed_dims,
            "mime_type": "image/jpeg",
            "compression_ratio": round((1 - processed_size/original_size) * 100, 1)
        }

        log(f"Image processed successfully: {cache_filename}")
        return jsonify(response), 200

    except Exception as e:
        log(f"UNEXPECTED ERROR: {str(e)}", "ERROR")
        log(traceback.format_exc(), "ERROR")
        return jsonify({"status": "error", "message": f"Internal error: {str(e)}"}), 500


@app.route('/info', methods=['GET'])
def info():
    """Informações sobre o serviço"""
    cache_files = list(CACHE_DIR.glob('*.jpg'))
    cache_size = sum(f.stat().st_size for f in cache_files) / (1024 * 1024)  # MB

    return jsonify({
        "service": "image_transformer",
        "version": "1.0",
        "port": 5000,
        "cache_dir": str(CACHE_DIR),
        "cached_files": len(cache_files),
        "cache_size_mb": round(cache_size, 2),
        "endpoints": {
            "GET /health": "Healthcheck",
            "POST /process": "Process image",
            "GET /info": "Service info"
        }
    })


if __name__ == '__main__':
    log(f"Starting Image Transformer Service...")
    log(f"Cache directory: {CACHE_DIR}")
    log(f"Listening on http://127.0.0.1:5000")
    log(f"Press Ctrl+C to stop")

    # Cria a pasta se não existir
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    # Inicia servidor Flask
    # use_reloader=False para evitar double-loading
    app.run(host='127.0.0.1', port=5000, debug=False, use_reloader=False)
