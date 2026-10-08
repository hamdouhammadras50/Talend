#!/usr/bin/env python3
"""Genere l'archive d'import Talend (Import Items) du job EDICOM_Commandes_XML.

Usage : python3 build_talend_zip.py <dossier_sortie>

Le job produit :
  tPrejob -> tJava (nom du fichier) -> tOracleConnection
  tOracleInput (requete extraction_commandes.sql) --row1--> tAdvancedFileOutputXML
    (Commandes / Commande [groupe] / Entete + Lignes / Ligne [boucle])
  tOracleInput --OnSubjobOk--> tJava (bilan) --RunIf(SFTP_ACTIVE && lignes > 0)--> tFTPPut (SFTP)
  tPostjob -> tOracleClose
"""
import os
import sys
import uuid
import zipfile
from datetime import datetime
from xml.sax.saxutils import quoteattr

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = "EDICOM"
JOB = "EDICOM_Commandes_XML"
VERSION = "0.1"
FOLDER = "EDICOM"

HEADER_COLS = [
    "CODE_CMDE", "CODE_PDV_FOURN", "I_PDV", "NUMERO_CMDE", "TYPE_CMDE", "DATE_LIVRAISON_CMDE",
    "CODE_ERP1_FOURN", "ENVOYEE_CMDE", "DATE_ENVOI_CMDE", "EMAIL_CMDES_FOURN", "LIBELLE_SITE",
    "ADRESSE_SITE", "TELEPHONE_SITE", "ADRESSE_LIVRAISON", "NOM_UTILISATEUR", "PRENOM_UTILISATEUR",
    "CODE_FOURN", "RAISON_SOCIALE_FOURN", "DATE_CMDE", "TOTAL_CMDE", "I_GLN_PDV",
    "I_GLN_DESTINATAIRE_DE_CMDE",
]
LINE_COLS = [
    "CODE_ARTICLE_FOURN_CMDE", "CODE_ERP1_ARTICLE", "QUANTITE_ARTICLE_CMDE", "TARIF_ARTICLE_CMDE",
    "CODE_ERP1_UNITE_CONSOMMATION", "LIBELLE_FAMILLE", "LIBELLE_ARTICLE_CMDE", "LIBELLE_UNITE_ACHAT",
    "TOTAL_ARTICLE_CMDE", "CODE_ARTICLE", "PRIX_VENTE_ARTICLE_CMDE", "PCB_ARTICLE_CMDE",
    "I_LIGNE_CMDE", "I_EAN", "N_MULTIPLE_COMMANDE", "I_OPERATION", "L_OPERATION",
]
ALL_COLS = HEADER_COLS + LINE_COLS

# (nom, type Talend, valeur par defaut, commentaire)
CONTEXT = [
    ("DB_HOST", "id_String", "localhost", "Serveur Oracle"),
    ("DB_PORT", "id_String", "1521", "Port Oracle"),
    ("DB_SERVICE_NAME", "id_String", "ORCL", "Service name Oracle"),
    ("DB_USER", "id_String", "approdirect", "Utilisateur Oracle"),
    ("DB_PASSWORD", "id_Password", "", "Mot de passe Oracle"),
    ("OUTPUT_DIR", "id_Directory", "C:/Talend/EDICOM/out", "Dossier local du fichier XML"),
    ("FILE_PREFIX", "id_String", "EDICOM_COMMANDES_", "Prefixe du nom de fichier"),
    ("SFTP_ACTIVE", "id_Boolean", "false", "false = recette (fichier local uniquement)"),
    ("SFTP_HOST", "id_String", "sftp.edicom.example", "Serveur SFTP EDICOM"),
    ("SFTP_PORT", "id_Integer", "22", "Port SFTP"),
    ("SFTP_USER", "id_String", "", "Utilisateur SFTP"),
    ("SFTP_PASSWORD", "id_Password", "", "Mot de passe SFTP"),
    ("SFTP_REMOTE_DIR", "id_String", "/", "Dossier distant de depot"),
]


def tid():
    return "_" + uuid.uuid4().hex[:22]


def read(name):
    with open(os.path.join(HERE, name), encoding="utf-8") as f:
        return f.read()


def sql_as_java_expression():
    """Requete SQL -> concatenation de chaines Java (une ligne par ligne SQL)."""
    lines = [l.rstrip() for l in read("extraction_commandes.sql").splitlines()]
    lines = [l for l in lines if l.strip() and not l.strip().startswith("--")]
    parts = ['"' + l.replace("\\", "\\\\").replace('"', '\\"') + ' "' for l in lines]
    return "\n+ ".join(parts)


def p(name, value, field="TEXT", show=None):
    attrs = f'field={quoteattr(field)} name={quoteattr(name)} value={quoteattr(value)}'
    if show is not None:
        attrs += f' show={quoteattr(show)}'
    return f"    <elementParameter {attrs}/>"


def table(name, rows):
    out = [f'    <elementParameter field="TABLE" name={quoteattr(name)}>']
    for row in rows:
        for ref, val in row:
            out.append(f"      <elementValue elementRef={quoteattr(ref)} value={quoteattr(val)}/>")
    out.append("    </elementParameter>")
    return "\n".join(out)


def metadata(unique_name, cols):
    out = [f'    <metadata connector="FLOW" label={quoteattr(unique_name)} name={quoteattr(unique_name)}>']
    for c in cols:
        out.append(
            f'      <column comment="" key="false" length="255" name="{c}" nullable="true" '
            f'originalDbColumnName="{c}" pattern="" precision="0" sourceType="VARCHAR2" '
            f'type="id_String" originalLength="-1" usefulColumn="true"/>'
        )
    out.append("    </metadata>")
    return "\n".join(out)


def node(component, version, unique, x, y, params, extra=""):
    body = "\n".join([p("UNIQUE_NAME", unique)] + params)
    if extra:
        body += "\n" + extra
    return (
        f'  <node componentName="{component}" componentVersion="{version}" offsetLabelX="0" '
        f'offsetLabelY="0" posX="{x}" posY="{y}">\n{body}\n  </node>'
    )


def connection(kind, label, style, source, target, unique, extra=None):
    params = [p("UNIQUE_NAME", unique)]
    if kind == "FLOW":
        params.insert(0, p("MONITOR_CONNECTION", "false", "CHECK"))
    params += extra or []
    body = "\n".join("  " + x for x in params)
    return (
        f'  <connection connectorName="{kind}" label="{label}" lineStyle="{style}" metaname="{source}" '
        f'offsetLabelX="0" offsetLabelY="0" source="{source}" target="{target}">\n{body}\n  </connection>'
    )


def subjob(start, title, color):
    return (
        "  <subjob>\n"
        f'{p("UNIQUE_NAME", start)}\n'
        f'{p("SUBJOB_TITLE_COLOR", title, "COLOR")}\n'
        f'{p("SUBJOB_COLOR", color, "COLOR")}\n'
        "  </subjob>"
    )


def xml_tree_tables():
    """Tables ROOT / GROUP / LOOP de tAdvancedFileOutputXML, au format enregistre par
    l'editeur de mapping de Talend Studio (FOXManager.tableLoader) :
    PATH, COLUMN, ATTRIBUTE (main = noeud sur le chemin racine -> boucle, sinon branch),
    VALUE, ORDER (numerotation en profondeur depuis la racine)."""
    order = iter(range(1, 1000))

    def row(path, column="", main=False):
        return [("PATH", path), ("COLUMN", column), ("ATTRIBUTE", "main" if main else "branch"),
                ("VALUE", ""), ("ORDER", str(next(order)))]

    root = [row("/Commandes", main=True)]
    cmde = "/Commandes/Commande"
    group = [row(cmde, main=True), row(cmde + "/Entete")]
    group += [row(f"{cmde}/Entete/{c}", c) for c in HEADER_COLS]
    group.append(row(cmde + "/Lignes", main=True))
    ligne = cmde + "/Lignes/Ligne"
    loop = [row(ligne, main=True)] + [row(f"{ligne}/{c}", c) for c in LINE_COLS]
    return root, group, loop


def build_item():
    ctx = "\n".join(
        f'    <contextParameter comment={quoteattr(c)} name="{n}" prompt="{n}?" promptNeeded="false" '
        f'repositoryContextId="" type="{t}" value={quoteattr(v)}/>'
        for n, t, v, c in CONTEXT
    )

    root_t, group_t, loop_t = xml_tree_tables()
    nodes = [
        node("tPrejob", "0.102", "tPrejob_1", 64, 64, []),
        node("tJava", "0.101", "tJava_2", 256, 64, [
            p("CODE", read("tJava_init.java"), "MEMO_JAVA"),
            p("LABEL", "Nom du fichier XML"),
        ]),
        node("tOracleConnection", "0.102", "tOracleConnection_1", 448, 64, [
            p("CONNECTION_TYPE", "ORACLE_SERVICE_NAME", "CLOSED_LIST"),
            p("DB_VERSION", "ORACLE_18", "CLOSED_LIST"),
            p("HOST", "context.DB_HOST"),
            p("PORT", "context.DB_PORT"),
            p("DBNAME", "context.DB_SERVICE_NAME"),
            p("SCHEMA_DB", '"APPRODIRECT"'),
            p("USER", "context.DB_USER"),
            p("PASS", "context.DB_PASSWORD", "PASSWORD"),
            p("AUTO_COMMIT", "false", "CHECK"),
            p("LABEL", "Connexion APPRODIRECT"),
        ]),
        node("tOracleInput", "0.102", "tOracleInput_1", 64, 224, [
            p("USE_EXISTING_CONNECTION", "true", "CHECK"),
            p("CONNECTION", "tOracleConnection_1", "COMPONENT_LIST"),
            p("TABLE", '"COMMANDE_ENVOI"', "DBTABLE"),
            p("QUERYSTORE:QUERYSTORE_TYPE", "BUILT_IN", "TECHNICAL"),
            p("QUERY", sql_as_java_expression(), "MEMO_SQL"),
            p("MAPPING", "oracle_id", "MAPPING_TYPE"),
            p("TRIM_ALL_COLUMN", "true", "CHECK"),
            p("LABEL", "Extraction commandes EDICOM"),
        ], metadata("tOracleInput_1", ALL_COLS)),
        node("tAdvancedFileOutputXML", "0.102", "tAdvancedFileOutputXML_1", 352, 224, [
            p("USESTREAM", "false", "CHECK"),
            p("FILENAME", '(String) globalMap.get("EDICOM_FILE_PATH")', "FILE"),
            table("ROOT", root_t),
            table("GROUP", group_t),
            table("LOOP", loop_t),
            p("CREATE", "true", "CHECK"),
            p("SPLIT", "false", "CHECK"),
            p("MERGE", "false", "CHECK"),
            p("PRETTY_COMPACT", "false", "CHECK"),
            p("FILE_VALID", "false", "CHECK"),
            p("TRIM", "false", "CHECK"),
            p("CREATE_EMPTY_ELEMENT", "true", "CHECK"),
            p("GENERATION_MODE", "Dom4j", "CLOSED_LIST"),
            p("ENCODING", '"UTF-8"', "ENCODING_TYPE"),
            p("ENCODING:ENCODING_TYPE", "UTF-8", "TECHNICAL"),
            p("DELETE_EMPTYFILE", "true", "CHECK"),
            p("LABEL", "XML EDICOM (Entete / Lignes)"),
        ], metadata("tAdvancedFileOutputXML_1", ALL_COLS)),
        node("tJava", "0.101", "tJava_1", 64, 384, [
            p("CODE", read("tJava_bilan.java"), "MEMO_JAVA"),
            p("LABEL", "Bilan"),
        ]),
        node("tFTPPut", "0.101", "tFTPPut_1", 352, 384, [
            p("USE_EXISTING_CONNECTION", "false", "CHECK"),
            p("HOST", "context.SFTP_HOST"),
            p("PORT", "context.SFTP_PORT"),
            p("USERNAME", "context.SFTP_USER"),
            p("PASSWORD", "context.SFTP_PASSWORD", "PASSWORD"),
            p("SFTP", "true", "CHECK"),
            p("FTPS", "false", "CHECK"),
            p("AUTH_METHOD", "PASSWORD", "CLOSED_LIST"),
            p("LOCALDIR", "context.OUTPUT_DIR", "DIRECTORY"),
            p("REMOTEDIR", "context.SFTP_REMOTE_DIR"),
            p("SFTPOVERWRITE", "overwrite", "CLOSED_LIST"),
            table("FILES", [[
                ("FILEMASK", '(String) globalMap.get("EDICOM_FILE_NAME")'),
                ("NEWNAME", '(String) globalMap.get("EDICOM_FILE_NAME")'),
            ]]),
            p("DIE_ON_ERROR", "true", "CHECK"),
            p("LABEL", "Depot SFTP EDICOM"),
        ]),
        node("tPostjob", "0.102", "tPostjob_1", 64, 544, []),
        node("tOracleClose", "0.102", "tOracleClose_1", 256, 544, [
            p("CONNECTION", "tOracleConnection_1", "COMPONENT_LIST"),
        ]),
    ]

    # lineStyle = id EConnectionType : FLOW_MAIN=0, ON_SUBJOB_OK=1, ON_COMPONENT_OK=3, RUN_IF=6
    connections = [
        connection("COMPONENT_OK", "OnComponentOk", 3, "tPrejob_1", "tJava_2", "OnComponentOk1"),
        connection("COMPONENT_OK", "OnComponentOk", 3, "tJava_2", "tOracleConnection_1", "OnComponentOk3"),
        connection("FLOW", "row1", 0, "tOracleInput_1", "tAdvancedFileOutputXML_1", "row1"),
        connection("SUBJOB_OK", "OnSubjobOk", 1, "tOracleInput_1", "tJava_1", "OnSubjobOk1"),
        connection("RUN_IF", "If1", 6, "tJava_1", "tFTPPut_1", "If1", [
            p("CONDITION",
              'context.SFTP_ACTIVE && globalMap.get("tAdvancedFileOutputXML_1_NB_LINE") != null\n'
              '&& ((Integer) globalMap.get("tAdvancedFileOutputXML_1_NB_LINE")) > 0', "MEMO_JAVA"),
        ]),
        connection("COMPONENT_OK", "OnComponentOk", 3, "tPostjob_1", "tOracleClose_1", "OnComponentOk2"),
    ]

    subjobs = [
        subjob("tPrejob_1", "230;100;0", "255;220;180"),
        subjob("tJava_2", "230;100;0", "255;220;180"),
        subjob("tOracleConnection_1", "230;100;0", "255;220;180"),
        subjob("tOracleInput_1", "160;190;240", "220;220;250"),
        subjob("tJava_1", "160;190;240", "220;220;250"),
        subjob("tFTPPut_1", "160;190;240", "220;220;250"),
        subjob("tPostjob_1", "230;100;0", "255;220;180"),
        subjob("tOracleClose_1", "230;100;0", "255;220;180"),
    ]

    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<talendfile:ProcessType xmi:version="2.0" xmlns:xmi="http://www.omg.org/XMI" '
        'xmlns:talendfile="platform:/resource/org.talend.model/model/TalendFile.xsd" '
        'defaultContext="Default" jobType="Standard">\n'
        f'  <context confirmationNeeded="false" name="Default">\n{ctx}\n  </context>\n'
        "  <parameters>\n"
        f'{p("JOB_RUN_VM_ARGUMENTS", " -Xms256M -Xmx1024M")}\n'
        f'{p("JOB_RUN_VM_ARGUMENTS_OPTION", "false", "CHECK")}\n'
        "  </parameters>\n"
        + "\n".join(nodes) + "\n"
        + "\n".join(connections) + "\n"
        + "\n".join(subjobs) + "\n"
        "</talendfile:ProcessType>\n"
    )


def build_properties(now, item_id, prop_id, state_id, author_id):
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<xmi:XMI xmi:version="2.0" xmlns:xmi="http://www.omg.org/XMI" xmlns:TalendProperties="http://www.talend.org/properties">
  <TalendProperties:Property xmi:id="{prop_id}" id="{tid()}" label="{JOB}" purpose="Flux XML quotidien des commandes vers EDICOM" description="Extraction APPRODIRECT (fournisseurs 47451 / 01811), generation XML Entete/Lignes (tAdvancedFileOutputXML), depot SFTP. Planification 07h30 et 10h00." creationDate="{now}" modificationDate="{now}" version="{VERSION}" statusCode="" item="{item_id}" displayName="{JOB}">
    <author href="../../TALEND.project#{author_id}"/>
  </TalendProperties:Property>
  <TalendProperties:ItemState xmi:id="{state_id}" path="{FOLDER}"/>
  <TalendProperties:ProcessItem xmi:id="{item_id}" property="{prop_id}" state="{state_id}">
    <process href="{JOB}_{VERSION}.item#/"/>
  </TalendProperties:ProcessItem>
</xmi:XMI>
'''


def build_project(now, author_id):
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<xmi:XMI xmi:version="2.0" xmlns:xmi="http://www.omg.org/XMI" xmlns:TalendProperties="http://www.talend.org/properties">
  <TalendProperties:Project xmi:id="{tid()}" label="{PROJECT}" description="" language="java" technicalLabel="{PROJECT}" local="true" creationDate="{now}" author="{author_id}"/>
  <TalendProperties:User xmi:id="{author_id}" login="talend@lagardere-tr.fr"/>
</xmi:XMI>
'''


def main():
    out_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..")
    now = datetime.now().astimezone().strftime("%Y-%m-%dT%H:%M:%S.000%z")
    item_id, prop_id, state_id, author_id = tid(), tid(), tid(), tid()
    base = f"{PROJECT}/process/{FOLDER}/{JOB}_{VERSION}"
    zip_path = os.path.join(out_dir, f"{JOB}_{VERSION}.zip")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(f"{PROJECT}/TALEND.project", build_project(now, author_id))
        z.writestr(base + ".item", build_item())
        z.writestr(base + ".properties", build_properties(now, item_id, prop_id, state_id, author_id))
    print(zip_path)


if __name__ == "__main__":
    main()
