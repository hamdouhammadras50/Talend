#!/usr/bin/env python3
"""Genere l'archive d'import Talend (Import Items) du job AGENT_EMAIL_AD,
reprise de GetAgentEmail.ps1 (agents Oracle REFERENTIEL completes par Active Directory).

Usage : python3 build_talend_zip.py <dossier_sortie>

  tPrejob -> tOracleConnection (REFERENTIEL)
  tLDAPInput_1 (domaine) -> tMap_1 -> tHashOutput_1      (dictionnaire AD)
     | OnSubjobOk
  tLDAPInput_2 (OU SharedMailbox) -> tHashOutput_2        (boites partagees ETEP)
     | OnSubjobOk
  tOracleInput_1 (agents) --row1--> tMap_2 --out--> tFileOutputDelimited_1 (CSV)
       lookups : tHashInput_1 (etep), tHashInput_2 (adId), tHashInput_3 (adSam)
                                          --maj--> tOracleOutput_1 (UPDATE, desactive)
  tPostjob -> tOracleClose
"""
import os
import sys
import uuid
import zipfile
from datetime import datetime
from xml.sax.saxutils import quoteattr

PROJECT = "AGENT"
JOB = "AGENT_EMAIL_AD"
VERSION = "0.1"
FOLDER = "AGENT"

AGENT_COLS = ["I_AGENT", "C_ETAT", "L_ETAT", "L_CIVILITE_NOM", "L_EMAIL_AD", "MAIL_DISPONIBLE", "I_SOCIETE"]
AD_COLS = ["dn", "employeeID", "sAMAccountName", "userPrincipalName", "userAccountControl", "description", "mail"]
ETEP_COLS = ["employeeID", "sAMAccountName"]
AD_HASH_COLS = AD_COLS + ["SAM_UPPER"]
OUT_COLS = ["I_agent", "c_etat", "l_etat", "l_civilite_nom", "i_societe", "l_email_ad", "mail_disponible",
            "AdStatus", "AdEmployeeID", "AduserPrincipalName", "AduserAccountControl", "AdPath",
            "AdDescription", "AdMail", "Admail_disponible"]
MAJ_COLS = ["I_AGENT", "L_EMAIL_AD", "MAIL_DISPONIBLE"]

CONTEXT = [
    ("DB_HOST", "id_String", "PRDORA-SCAN.ltrf.fr", "Serveur Oracle"),
    ("DB_PORT", "id_String", "1521", "Port Oracle"),
    ("DB_SERVICE", "id_String", "PROD", "Service name Oracle"),
    ("DB_USER", "id_String", "REFERENTIEL", "Utilisateur Oracle"),
    ("DB_PASSWORD", "id_Password", "", "Mot de passe Oracle"),
    ("LDAP_HOST", "id_String", "ltrf.fr", "Serveur Active Directory (domaine ou controleur)"),
    ("LDAP_PORT", "id_Integer", "389", "Port LDAP (636 en LDAPS)"),
    ("LDAP_USER", "id_String", "compte_service@ltrf.fr", "Compte de service AD (lecture)"),
    ("LDAP_PASSWORD", "id_Password", "", "Mot de passe du compte de service AD"),
    ("LDAP_BASEDN", "id_String", "DC=ltrf,DC=fr", "Racine de recherche des comptes"),
    ("LDAP_BASEDN_ETEP", "id_String", "OU=SharedMailbox,OU=Office365,OU=AppGroups,OU=SiegeLTRF,DC=ltrf,DC=fr",
     "OU des boites partagees ETEP"),
    ("OUTPUT_DIR", "id_Directory", "C:/Talend/AGENT", "Dossier du CSV"),
]

EMP8 = "String.format(\"%8s\", row1.I_AGENT).replace(' ', '0')"


def tid():
    return "_" + uuid.uuid4().hex[:22]


def p(name, value, field="TEXT"):
    return f"    <elementParameter field={quoteattr(field)} name={quoteattr(name)} value={quoteattr(value)}/>"


def table(name, rows):
    out = [f'    <elementParameter field="TABLE" name={quoteattr(name)}>']
    for row in rows:
        for ref, val in row:
            out.append(f"      <elementValue elementRef={quoteattr(ref)} value={quoteattr(val)}/>")
    out.append("    </elementParameter>")
    return "\n".join(out)


def metadata(name, cols, keys=()):
    out = [f'    <metadata connector="FLOW" label={quoteattr(name)} name={quoteattr(name)}>']
    for c in cols:
        out.append(
            f'      <column comment="" key="{"true" if c in keys else "false"}" length="255" name="{c}" '
            f'nullable="{"false" if c in keys else "true"}" originalDbColumnName="{c}" pattern="" precision="0" '
            f'sourceType="" type="id_String" originalLength="-1" usefulColumn="true"/>'
        )
    out.append("    </metadata>")
    return "\n".join(out)


def node(component, version, unique, x, y, params, extra="", active=True):
    params = [p("UNIQUE_NAME", unique)] + params
    if not active:
        params.append(p("ACTIVATE", "false", "CHECK"))
    body = "\n".join(params)
    if extra:
        body += "\n" + extra
    return (f'  <node componentName="{component}" componentVersion="{version}" offsetLabelX="0" '
            f'offsetLabelY="0" posX="{x}" posY="{y}">\n{body}\n  </node>')


def connection(kind, label, style, source, target, unique, metaname=None, extra=None):
    params = [p("UNIQUE_NAME", unique)]
    if kind == "FLOW":
        params.insert(0, p("MONITOR_CONNECTION", "false", "CHECK"))
    params += extra or []
    body = "\n".join("  " + x for x in params)
    return (f'  <connection connectorName="{kind}" label="{label}" lineStyle="{style}" '
            f'metaname="{metaname or source}" offsetLabelX="0" offsetLabelY="0" source="{source}" '
            f'target="{target}">\n{body}\n  </connection>')


def subjob(start, title="160;190;240", color="220;220;250"):
    return ("  <subjob>\n" + "\n".join([p("UNIQUE_NAME", start), p("SUBJOB_TITLE_COLOR", title, "COLOR"),
                                         p("SUBJOB_COLOR", color, "COLOR")]) + "\n  </subjob>")


# ---------- tMap (nodeData TalendMapper:MapperData) ----------
def entry(name, expression=None, type_="id_String", nullable=True):
    expr = f" expression={quoteattr(expression)}" if expression is not None else ""
    return (f'      <mapperTableEntries name="{name}"{expr} type="{type_}" '
            f'nullable="{"true" if nullable else "false"}"/>')


def in_table(name, cols, keys=None, mode="UNIQUE_MATCH"):
    keys = keys or {}
    rows = "\n".join(entry(c, keys.get(c)) for c in cols)
    return (f'    <inputTables sizeState="INTERMEDIATE" name="{name}" matchingMode="{mode}" '
            f'lookupMode="LOAD_ONCE" innerJoin="false">\n{rows}\n    </inputTables>')


def out_table(name, exprs, filt=None):
    f = (f' expressionFilter={quoteattr(filt)} activateExpressionFilter="true"' if filt else "")
    rows = "\n".join(entry(c, e) for c, e in exprs)
    return f'    <outputTables sizeState="INTERMEDIATE" name="{name}"{f}>\n{rows}\n    </outputTables>'


def var_table(vars_):
    rows = "\n".join(entry(n, e, t, False) for n, e, t in vars_)
    return f'    <varTables sizeState="INTERMEDIATE" name="Var">\n{rows}\n    </varTables>' if vars_ \
        else '    <varTables sizeState="INTERMEDIATE" name="Var" minimized="true"/>'


def mapper(inputs, outputs, vars_=()):
    return ('    <nodeData xsi:type="TalendMapper:MapperData">\n      <uiProperties shellMaximized="true"/>\n'
            + var_table(list(vars_)) + "\n" + "\n".join(outputs) + "\n" + "\n".join(inputs) + "\n    </nodeData>")


def tmap_ad():
    exprs = [(c, f"ad.{c}") for c in AD_COLS]
    exprs.append(("SAM_UPPER", "ad.sAMAccountName == null ? null : ad.sAMAccountName.toUpperCase()"))
    return mapper([in_table("ad", AD_COLS)], [out_table("adDico", exprs)])


def tmap_agents():
    def ad(col):
        return f"!Var.trouve ? null : (Var.etep ? adSam.{col} : adId.{col})"
    out = [
        ("I_agent", "row1.I_AGENT"), ("c_etat", "row1.C_ETAT"), ("l_etat", "row1.L_ETAT"),
        ("l_civilite_nom", "row1.L_CIVILITE_NOM"), ("i_societe", "row1.I_SOCIETE"),
        ("l_email_ad", "row1.L_EMAIL_AD"), ("mail_disponible", "row1.MAIL_DISPONIBLE"),
        ("AdStatus", 'Var.trouve ? "Found by EmployeID" : null'),
        ("AdEmployeeID", ad("employeeID")),
        ("AduserPrincipalName", ad("userPrincipalName")),
        ("AduserAccountControl", "Var.uac"),
        ("AdPath", '!Var.trouve ? null : "LDAP://" + (Var.etep ? adSam.dn : adId.dn)'),
        ("AdDescription", ad("description")),
        ("AdMail", "Var.mail"),
        ("Admail_disponible", "Var.dispo"),
    ]
    maj = [("I_AGENT", "row1.I_AGENT"), ("L_EMAIL_AD", "Var.mail"), ("MAIL_DISPONIBLE", "Var.dispo")]
    vars_ = [
        ("etep", '"16".equals(row1.I_SOCIETE)', "id_Boolean"),
        ("trouve", "Var.etep ? adSam.SAM_UPPER != null : adId.employeeID != null", "id_Boolean"),
        ("uac", "!Var.trouve ? null : (Var.etep ? adSam.userAccountControl : adId.userAccountControl)", "id_String"),
        ("mail", '!Var.trouve ? "" : (Var.etep ? adSam.mail : adId.mail)', "id_String"),
        ("dispo", '(!Var.trouve || Var.uac == null) ? "" : ((Integer.parseInt(Var.uac.trim()) & 2) == 2 ? "N" : "O")',
         "id_String"),
    ]
    inputs = [
        in_table("row1", AGENT_COLS),
        in_table("etep", ETEP_COLS, {"employeeID": f'"16".equals(row1.I_SOCIETE) ? {EMP8} : ""'}, "FIRST_MATCH"),
        in_table("adId", AD_HASH_COLS, {"employeeID": f'"16".equals(row1.I_SOCIETE) ? "" : {EMP8}'}, "FIRST_MATCH"),
        in_table("adSam", AD_HASH_COLS, {"SAM_UPPER": 'etep.sAMAccountName == null ? "" : '
                                                      'etep.sAMAccountName.replaceAll("(?i)_ETEP", "").toUpperCase()'},
                 "FIRST_MATCH"),
    ]
    return mapper(inputs, [out_table("out", out), out_table("maj", maj, "Var.trouve")], vars_)


def ldap(unique, x, y, basedn, filt, cols):
    return node("tLDAPInput", "0.102", unique, x, y, [
        p("USE_EXISTING_CONNECTION", "false", "CHECK"),
        p("HOST", "context.LDAP_HOST"),
        p("PORT", "context.LDAP_PORT"),
        p("BASEDN", basedn),
        p("PROTOCOL", "LDAP", "CLOSED_LIST"),
        p("AUTHENTIFICATION", "true", "CHECK"),
        p("USER", "context.LDAP_USER"),
        p("PASS", "context.LDAP_PASSWORD", "PASSWORD"),
        p("ALIASES", "never", "CLOSED_LIST"),
        p("REFERRALS", "ignore", "CLOSED_LIST"),
        p("FILTER", filt, "MEMO"),
        p("MULTI_VALUE_SEPARATOR", '";"'),
        p("LIMIT", "0"),
        p("TIMEOUT", "0"),
        p("ISPAGING", "true", "CHECK"),
        p("PAGESIZE", "1000"),
        p("DIE_ON_ERROR", "true", "CHECK"),
    ], metadata(unique, cols))


def hash_out(unique, x, y, cols):
    return node("tHashOutput", "0.101", unique, x, y, [
        p("LINK_WITH", "false", "CHECK"),
        p("DATA_WRITE_MODEL", "MEMORY", "CLOSED_LIST"),
        p("KEYS_MANAGEMENT", "KEEP_ALL", "CLOSED_LIST"),
        p("APPEND", "true", "CHECK"),
    ], metadata(unique, cols))


def hash_in(unique, x, y, link, cols):
    return node("tHashInput", "0.102", unique, x, y, [
        p("LINK_WITH", "true", "CHECK"),
        p("LIST", link, "COMPONENT_LIST"),
        p("RELEASE_CACHE", "false", "CHECK"),
    ], metadata(unique, cols))


def build_item():
    ctx = "\n".join(
        f'    <contextParameter comment={quoteattr(c)} name="{n}" prompt="{n}?" promptNeeded="false" '
        f'repositoryContextId="" type="{t}" value={quoteattr(v)}/>' for n, t, v, c in CONTEXT)
    query = ('"SELECT ag.i_agent, ag.c_etat, ag.l_etat, ag.l_civilite_nom, " +\n'
             '"       ag.l_email_ad, ag.mail_disponible, ag.i_societe " +\n'
             '"  FROM referentiel.agent ag " +\n'
             '" WHERE 1=1 "')
    nodes = [
        node("tPrejob", "0.102", "tPrejob_1", 64, 32, []),
        node("tOracleConnection", "0.102", "tOracleConnection_1", 288, 32, [
            p("CONNECTION_TYPE", "ORACLE_SERVICE_NAME", "CLOSED_LIST"),
            p("DB_VERSION", "ORACLE_18", "CLOSED_LIST"),
            p("HOST", "context.DB_HOST"), p("PORT", "context.DB_PORT"),
            p("DBNAME", "context.DB_SERVICE"), p("SCHEMA_DB", '"REFERENTIEL"'),
            p("USER", "context.DB_USER"), p("PASS", "context.DB_PASSWORD", "PASSWORD"),
            p("AUTO_COMMIT", "false", "CHECK"),
        ]),
        ldap("tLDAPInput_1", 64, 160, "context.LDAP_BASEDN",
             '"(|(employeeID=*)(&(objectCategory=person)(objectClass=user)))"', AD_COLS),
        node("tMap", "2.1", "tMap_1", 288, 160, [p("DIE_ON_ERROR", "true", "CHECK")],
             metadata("adDico", AD_HASH_COLS) + "\n" + tmap_ad()),
        hash_out("tHashOutput_1", 512, 160, AD_HASH_COLS),
        ldap("tLDAPInput_2", 64, 288, "context.LDAP_BASEDN_ETEP", '"(employeeID=*)"', ETEP_COLS),
        hash_out("tHashOutput_2", 512, 288, ETEP_COLS),
        node("tOracleInput", "0.102", "tOracleInput_1", 64, 448, [
            p("USE_EXISTING_CONNECTION", "true", "CHECK"),
            p("CONNECTION", "tOracleConnection_1", "COMPONENT_LIST"),
            p("TABLE", '"AGENT"', "DBTABLE"),
            p("QUERYSTORE:QUERYSTORE_TYPE", "BUILT_IN", "TECHNICAL"),
            p("QUERY", query, "MEMO_SQL"),
            p("TRIM_ALL_COLUMN", "true", "CHECK"),
        ], metadata("tOracleInput_1", AGENT_COLS)),
        hash_in("tHashInput_1", 160, 576, "tHashOutput_2", ETEP_COLS),
        hash_in("tHashInput_2", 288, 608, "tHashOutput_1", AD_HASH_COLS),
        hash_in("tHashInput_3", 416, 576, "tHashOutput_1", AD_HASH_COLS),
        node("tMap", "2.1", "tMap_2", 288, 448, [p("DIE_ON_ERROR", "true", "CHECK")],
             metadata("out", OUT_COLS) + "\n" + metadata("maj", MAJ_COLS, keys=("I_AGENT",)) + "\n" + tmap_agents()),
        node("tFileOutputDelimited", "0.101", "tFileOutputDelimited_1", 544, 416, [
            p("FILENAME", 'context.OUTPUT_DIR + "/OracleAgentCompletedByAd.csv"', "FILE"),
            p("ROWSEPARATOR", '"\\n"'),
            p("FIELDSEPARATOR", '","'),
            p("APPEND", "false", "CHECK"),
            p("INCLUDEHEADER", "true", "CHECK"),
            p("CSV_OPTION", "true", "CHECK"),
            p("ESCAPE_CHAR", '"\\""'),
            p("TEXT_ENCLOSURE", '"\\""'),
            p("CREATE", "true", "CHECK"),
            p("ENCODING", '"UTF-8"', "ENCODING_TYPE"),
            p("ENCODING:ENCODING_TYPE", "UTF-8", "TECHNICAL"),
        ], metadata("tFileOutputDelimited_1", OUT_COLS)),
        node("tOracleOutput", "0.102", "tOracleOutput_1", 544, 512, [
            p("USE_EXISTING_CONNECTION", "true", "CHECK"),
            p("CONNECTION", "tOracleConnection_1", "COMPONENT_LIST"),
            p("TABLE", '"AGENT"', "DBTABLE"),
            p("TABLE_ACTION", "NONE", "CLOSED_LIST"),
            p("DATA_ACTION", "UPDATE", "CLOSED_LIST"),
            p("DIE_ON_ERROR", "true", "CHECK"),
        ], metadata("tOracleOutput_1", MAJ_COLS, keys=("I_AGENT",)), active=False),
        node("tOracleCommit", "0.102", "tOracleCommit_1", 64, 672, [
            p("CONNECTION", "tOracleConnection_1", "COMPONENT_LIST"),
            p("CLOSE", "false", "CHECK"),
        ], active=False),
        node("tPostjob", "0.102", "tPostjob_1", 64, 784, []),
        node("tOracleClose", "0.102", "tOracleClose_1", 288, 784, [
            p("CONNECTION", "tOracleConnection_1", "COMPONENT_LIST"),
        ]),
    ]
    # lineStyle = id EConnectionType : FLOW_MAIN=0, ON_SUBJOB_OK=1, ON_COMPONENT_OK=3, FLOW_REF(lookup)=8
    connections = [
        connection("COMPONENT_OK", "OnComponentOk", 3, "tPrejob_1", "tOracleConnection_1", "OnComponentOk1"),
        connection("FLOW", "ad", 0, "tLDAPInput_1", "tMap_1", "ad"),
        connection("FLOW", "adDico", 0, "tMap_1", "tHashOutput_1", "adDico", metaname="adDico"),
        connection("SUBJOB_OK", "OnSubjobOk", 1, "tLDAPInput_1", "tLDAPInput_2", "OnSubjobOk1"),
        connection("FLOW", "etepDico", 0, "tLDAPInput_2", "tHashOutput_2", "etepDico"),
        connection("SUBJOB_OK", "OnSubjobOk", 1, "tLDAPInput_2", "tOracleInput_1", "OnSubjobOk2"),
        connection("FLOW", "row1", 0, "tOracleInput_1", "tMap_2", "row1"),
        connection("FLOW", "etep", 8, "tHashInput_1", "tMap_2", "etep"),
        connection("FLOW", "adId", 8, "tHashInput_2", "tMap_2", "adId"),
        connection("FLOW", "adSam", 8, "tHashInput_3", "tMap_2", "adSam"),
        connection("FLOW", "out", 0, "tMap_2", "tFileOutputDelimited_1", "out", metaname="out"),
        connection("FLOW", "maj", 0, "tMap_2", "tOracleOutput_1", "maj", metaname="maj"),
        connection("SUBJOB_OK", "OnSubjobOk", 1, "tOracleInput_1", "tOracleCommit_1", "OnSubjobOk3"),
        connection("COMPONENT_OK", "OnComponentOk", 3, "tPostjob_1", "tOracleClose_1", "OnComponentOk2"),
    ]
    subjobs = [subjob("tPrejob_1", "230;100;0", "255;220;180"), subjob("tOracleConnection_1", "230;100;0", "255;220;180"),
               subjob("tLDAPInput_1"), subjob("tLDAPInput_2"), subjob("tOracleInput_1"), subjob("tOracleCommit_1"),
               subjob("tPostjob_1", "230;100;0", "255;220;180"), subjob("tOracleClose_1", "230;100;0", "255;220;180")]
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<talendfile:ProcessType xmi:version="2.0" xmlns:xmi="http://www.omg.org/XMI" '
            'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
            'xmlns:TalendMapper="http://www.talend.org/mapper" '
            'xmlns:talendfile="platform:/resource/org.talend.model/model/TalendFile.xsd" '
            'defaultContext="Default" jobType="Standard">\n'
            f'  <context confirmationNeeded="false" name="Default">\n{ctx}\n  </context>\n'
            "  <parameters>\n" + p("JOB_RUN_VM_ARGUMENTS", " -Xms256M -Xmx2048M") + "\n"
            + p("JOB_RUN_VM_ARGUMENTS_OPTION", "false", "CHECK") + "\n  </parameters>\n"
            + "\n".join(nodes) + "\n" + "\n".join(connections) + "\n" + "\n".join(subjobs) + "\n"
            "</talendfile:ProcessType>\n")


def build_properties(now, item_id, prop_id, state_id, author_id):
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<xmi:XMI xmi:version="2.0" xmlns:xmi="http://www.omg.org/XMI" xmlns:TalendProperties="http://www.talend.org/properties">
  <TalendProperties:Property xmi:id="{prop_id}" id="{tid()}" label="{JOB}" purpose="Reprise de GetAgentEmail.ps1" description="Agents REFERENTIEL.AGENT completes par Active Directory (employeeID, ETEP via SharedMailbox), export CSV OracleAgentCompletedByAd.csv. Mise a jour Oracle desactivee." creationDate="{now}" modificationDate="{now}" version="{VERSION}" statusCode="" item="{item_id}" displayName="{JOB}">
    <author href="../../talend.project#{author_id}"/>
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
    out_dir = sys.argv[1] if len(sys.argv) > 1 else "."
    now = datetime.now().astimezone().strftime("%Y-%m-%dT%H:%M:%S.000%z")
    item_id, prop_id, state_id, author_id = tid(), tid(), tid(), tid()
    base = f"{PROJECT}/process/{FOLDER}/{JOB}_{VERSION}"
    zip_path = os.path.join(out_dir, f"{JOB}_{VERSION}.zip")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        # Le Studio cherche "talend.project" en minuscules
        for d in (f"{PROJECT}/", f"{PROJECT}/process/", f"{PROJECT}/process/{FOLDER}/"):
            z.writestr(d, "")
        z.writestr(f"{PROJECT}/talend.project", build_project(now, author_id))
        z.writestr(base + ".item", build_item())
        z.writestr(base + ".properties", build_properties(now, item_id, prop_id, state_id, author_id))
    print(zip_path)


if __name__ == "__main__":
    main()
