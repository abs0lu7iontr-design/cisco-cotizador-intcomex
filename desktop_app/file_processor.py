import os
import re
import shutil
from datetime import datetime
from typing import Dict, Any, Tuple

class FileProcessor:
    """
    Analyzes uploaded Estimate files, extracts Partner and Cliente Final via strict Regex,
    creates automatic hierarchical folder structures (Partner/Cliente/Mes/Dia/),
    and validates file integrity.
    """
    
    # Comprehensive Format Regex:
    # [Partner]_[ClienteFinal]_[ID_Cotizacion]_[Nombre_Preventa]_[Fecha].xlsx
    # or [Partner]_[ClienteFinal]_resto_del_nombre.xlsx
    STRICT_FILENAME_REGEX = re.compile(r"^([A-Za-z0-9\-\.\s]+)_([A-Za-z0-9\-\.\s]+)(?:_(.+))?\.(xlsx|xls)$", re.IGNORECASE)

    def __init__(self, base_storage_dir: str = None):
        if base_storage_dir is None:
            # Default storage root folder in user home or current project directory
            self.base_storage_dir = os.path.join(os.getcwd(), "gravity_storage")
        else:
            self.base_storage_dir = base_storage_dir

    def parse_filename(self, filename: str) -> Tuple[bool, str, str, str]:
        """
        Parses filename using Regex or fallback defaults.
        Returns: (is_valid, partner_name, client_final_name, error_message)
        """
        basename = os.path.basename(filename)
        name_without_ext = basename.rsplit('.', 1)[0]
        ext = basename.rsplit('.', 1)[1].lower() if '.' in basename else ''

        if ext not in ['xlsx', 'xls', 'xlsm']:
            return (False, "", "", f"El archivo '{basename}' debe tener extensión .xlsx o .xls.")

        parts = name_without_ext.split('_')
        if len(parts) >= 2:
            partner = parts[0].strip() or "Intcomex"
            client = parts[1].strip() or "Cliente"
            return (True, partner, client, "")
        else:
            # Forgiving default for single-word filenames (e.g. CiscoDealBOM.xls)
            partner = "Intcomex"
            client = name_without_ext.strip() or "General"
            return (True, partner, client, "")


    def organize_and_store_file(self, source_filepath: str, upload_date: datetime = None) -> Dict[str, Any]:
        """
        Extracts Partner & Client, creates hierarchical folder structure:
        storage_root / Partner / ClienteFinal / YYYY-MM / YYYY-MM-DD /
        and copies the file there.
        """
        if upload_date is None:
            upload_date = datetime.now()

        filename = os.path.basename(source_filepath)
        is_valid, partner, client, err_msg = self.parse_filename(filename)

        if not is_valid:
            raise ValueError(err_msg)

        # Build date folder strings
        month_dir = upload_date.strftime("%Y-%m")
        day_dir = upload_date.strftime("%Y-%m-%d")

        # Hierarchical Path: Partner / Cliente Final / YYYY-MM / YYYY-MM-DD /
        relative_dir = os.path.join(partner, client, month_dir, day_dir)
        target_dir = os.path.join(self.base_storage_dir, relative_dir)

        # Auto-create directory structure if it doesn't exist
        os.makedirs(target_dir, exist_ok=True)

        target_filepath = os.path.join(target_dir, filename)

        # Copy original file to target hierarchical storage path
        shutil.copy2(source_filepath, target_filepath)

        return {
            "partner_name": partner,
            "client_final_name": client,
            "original_filename": filename,
            "stored_filepath": target_filepath,
            "relative_dir": relative_dir,
            "created_at": upload_date.isoformat()
        }

    def save_estimate_in_client_month_structure(
        self,
        file_bytes: bytes,
        partner_name: str,
        client_final_name: str,
        filename: str,
        custom_date: datetime = None
    ) -> Dict[str, Any]:
        """
        Creates hierarchical structure:
        storage_root / [Canal_Partner] / [ClienteFinal] / [Mes_Espanol] / [filename]
        Example: gravity_storage / Intcomex / Banco de Chile / Agosto / Cotizacion_BancoDeChile.xlsx
        """
        if custom_date is None:
            custom_date = datetime.now()

        meses_espanol = {
            1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril",
            5: "Mayo", 6: "Junio", 7: "Julio", 8: "Agosto",
            9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre"
        }

        # Sanitize folder names
        def sanitize_name(name: str) -> str:
            clean = re.sub(r'[\\/*?:"<>|]', '', (name or '').strip())
            return clean or "General"

        clean_partner = sanitize_name(partner_name)
        clean_client = sanitize_name(client_final_name)
        clean_month = meses_espanol.get(custom_date.month, "Mes")
        clean_filename = sanitize_name(filename)
        if not clean_filename.lower().endswith(('.xlsx', '.xls')):
            clean_filename += ".xlsx"

        relative_dir = os.path.join(clean_partner, clean_client, clean_month)
        target_dir = os.path.join(self.base_storage_dir, relative_dir)
        os.makedirs(target_dir, exist_ok=True)

        target_filepath = os.path.join(target_dir, clean_filename)
        with open(target_filepath, 'wb') as f:
            f.write(file_bytes)

        return {
            "success": True,
            "partner": clean_partner,
            "client": clean_client,
            "month": clean_month,
            "filename": clean_filename,
            "filepath": os.path.abspath(target_filepath),
            "folder": os.path.abspath(target_dir),
            "relative_dir": relative_dir
        }

