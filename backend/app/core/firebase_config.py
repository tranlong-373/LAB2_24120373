import firebase_admin
from firebase_admin import credentials, firestore

from backend.app.core.settings import firebase_admin as firebase_admin_settings

if not firebase_admin._apps:
    if "service_account_path" in firebase_admin_settings:
        cred = credentials.Certificate(firebase_admin_settings["service_account_path"])
    else:
        cred_dict = dict(firebase_admin_settings)
        if "private_key" in cred_dict:
            cred_dict["private_key"] = cred_dict["private_key"].replace("\\n", "\n")
        cred = credentials.Certificate(cred_dict)

    firebase_admin.initialize_app(cred)

db = firestore.client()
