#!/usr/bin/env python3
"""Genere TestTJavaFlex.java : execute le code exact du tJavaFlex/tJava sur des donnees fictives
(sans base Oracle) pour valider la compilation et produire un XML d'exemple."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_talend_zip import ALL_COLS, HEADER_COLS, read

def row(cmde, num, fourn, gln, ligne, art, qte, prix, lib):
    h = {"CODE_CMDE": cmde, "CODE_PDV_FOURN": "PDV-0042", "I_PDV": "42", "NUMERO_CMDE": num,
         "TYPE_CMDE": "STD", "DATE_LIVRAISON_CMDE": "2026-08-20", "CODE_ERP1_FOURN": fourn,
         "ENVOYEE_CMDE": "O", "DATE_ENVOI_CMDE": "2026-08-18 07:12:45",
         "EMAIL_CMDES_FOURN": "commandes@fournisseur.example", "LIBELLE_SITE": "Relay Paris Gare de Lyon",
         "ADRESSE_SITE": "Place Louis-Armand, 75012 Paris", "TELEPHONE_SITE": "01 23 45 67 89",
         "ADRESSE_LIVRAISON": "Quai 3 - Reserve <B> & stock", "NOM_UTILISATEUR": "DUPONT",
         "PRENOM_UTILISATEUR": "Hélène", "CODE_FOURN": "F" + fourn, "RAISON_SOCIALE_FOURN": "Fournisseur " + fourn,
         "DATE_CMDE": "2026-08-18", "TOTAL_CMDE": "152.40", "I_GLN_PDV": "3020000000427",
         "I_GLN_DESTINATAIRE_DE_CMDE": gln}
    l = {"CODE_ARTICLE_FOURN_CMDE": "AF" + art, "CODE_ERP1_ARTICLE": art, "QUANTITE_ARTICLE_CMDE": qte,
         "TARIF_ARTICLE_CMDE": prix, "CODE_ERP1_UNITE_CONSOMMATION": "UC", "LIBELLE_FAMILLE": "Confiserie",
         "LIBELLE_ARTICLE_CMDE": lib, "LIBELLE_UNITE_ACHAT": "Carton", "TOTAL_ARTICLE_CMDE": "76.20",
         "CODE_ARTICLE": "A" + art, "PRIX_VENTE_ARTICLE_CMDE": "2.50", "PCB_ARTICLE_CMDE": "12",
         "I_LIGNE_CMDE": ligne, "I_EAN": "3017620422003", "N_MULTIPLE_COMMANDE": "1",
         "I_OPERATION": None, "L_OPERATION": None}
    h.update(l); return h

rows = [
    row("1001", "CMD-2026-0001", "01811", "3013097500114", "1", "500101", "6", "12.70", "Barre chocolat 50g"),
    row("1001", "CMD-2026-0001", "01811", "3013097500114", "2", "500102", "6", "12.70", "Bonbons acidulés \"fruits\""),
    row("1002", "CMD-2026-0002", "47451", "3013086500101", "1", "700201", "3", "25.40", "Chewing-gum menthe x10"),
]

def jstr(v):
    return "null" if v is None else '"' + v.replace("\\", "\\\\").replace('"', '\\"') + '"'

fields = "\n".join(f"        String {c};" for c in ALL_COLS)
data = []
for r in rows:
    data.append("        r = new Row1();")
    data += [f"        r.{c} = {jstr(r[c])};" for c in ALL_COLS]
    data.append("        rows.add(r);")
src = f"""
public class TestTJavaFlex {{
    static class Row1 {{
{fields}
    }}
    static class Ctx {{
        String OUTPUT_DIR; String FILE_PREFIX = "EDICOM_COMMANDES_"; String XML_ROOT = "Commandes";
        boolean SFTP_ACTIVE = false;
    }}
    public static void main(String[] args) throws Exception {{
        Ctx context = new Ctx();
        context.OUTPUT_DIR = args[0];
        java.util.Map<String, Object> globalMap = new java.util.HashMap<String, Object>();
        java.util.List<Row1> rows = new java.util.ArrayList<Row1>();
        Row1 r;
        if (args.length < 2) {{
{chr(10).join(data)}
        }}
        // ---- tJavaFlex start
{read("tJavaFlex_start.java")}
        for (Row1 row1 : rows) {{
        // ---- tJavaFlex main
{read("tJavaFlex_main.java")}
        }}
        // ---- tJavaFlex end
{read("tJavaFlex_end.java")}
        // ---- tJava bilan
{read("tJava_bilan.java")}
    }}
}}
"""
open(sys.argv[1], "w", encoding="utf-8").write(src)
