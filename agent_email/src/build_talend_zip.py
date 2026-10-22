#!/usr/bin/env python3
"""Genere l'archive d'import Talend (Import Items) du job AGENT_EMAIL_AD,
reprise de GetAgentEmail.ps1 : liste matricule + mail, uniquement depuis Active Directory
(aucune source externe : ni Oracle, ni SQL Server).

Usage : python3 build_talend_zip.py <dossier_sortie>

  tLDAPInput_1 (domaine) -> tMap_1 -> tHashOutput_1          (comptes AD)
     | OnSubjobOk
  tLDAPInput_2 (OU SharedMailbox) -> tMap_3 -> tHashOutput_2  (boites ETEP, cle = sAMAccountName sans _ETEP)
     | OnSubjobOk
  tHashInput_1 (comptes) --ad--> tMap_2 --out--> tFileOutputDelimited_1 (CSV MATRICULE;MAIL)
       lookup : tHashInput_2 (etep, sur SAM_UPPER)
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

AD_COLS = ["dn", "employeeID", "sAMAccountName", "userPrincipalName", "userAccountControl", "description", "mail"]
ETEP_COLS = ["employeeID", "sAMAccountName"]
AD_HASH_COLS = AD_COLS + ["SAM_UPPER"]
ETEP_HASH_COLS = ETEP_COLS + ["SAM_LTRF_UPPER"]
OUT_COLS = ["MATRICULE", "MAIL"]
CONTEXT = [
    ("LDAP_HOST", "id_String", "ltrf.fr", "Serveur Active Directory (domaine ou controleur)"),
    ("LDAP_PORT", "id_Integer", "389", "Port LDAP (636 en LDAPS)"),
    ("LDAP_USER", "id_String", "compte_service@ltrf.fr", "Compte de service AD (lecture)"),
    ("LDAP_PASSWORD", "id_Password", "", "Mot de passe du compte de service AD"),
    ("LDAP_BASEDN", "id_String", "DC=ltrf,DC=fr", "Racine de recherche des comptes"),
    ("LDAP_BASEDN_ETEP", "id_String", "OU=SharedMailbox,OU=Office365,OU=AppGroups,OU=SiegeLTRF,DC=ltrf,DC=fr",
     "OU des boites partagees ETEP"),
    ("OUTPUT_DIR", "id_Directory", "C:/Talend/AGENT", "Dossier du CSV"),
]



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


def tmap_etep():
    exprs = [(c, f"etep.{c}") for c in ETEP_COLS]
    exprs.append(("SAM_LTRF_UPPER", 'etep.sAMAccountName == null ? null : '
                                    'etep.sAMAccountName.replaceAll("(?i)_ETEP", "").toUpperCase()'))
    return mapper([in_table("etep", ETEP_COLS)], [out_table("etepDico", exprs)])


def tmap_resultat():
    vars_ = [
        # Matricule porte par le compte lui-meme, sinon par sa boite partagee _ETEP (societe 16)
        ("matricule", '(adCpt.employeeID != null && !adCpt.employeeID.trim().isEmpty()) ? adCpt.employeeID.trim() : '
                      '(etepLk.employeeID == null ? "" : etepLk.employeeID.trim())', "id_String"),
        ("mail", 'adCpt.mail == null ? "" : adCpt.mail.trim()', "id_String"),
        # Compte actif : bit 2 (ACCOUNTDISABLE) de userAccountControl absent
        ("actif", 'adCpt.userAccountControl != null && (Integer.parseInt(adCpt.userAccountControl.trim()) & 2) == 0',
         "id_Boolean"),
    ]
    out = [("MATRICULE", "Var.matricule"), ("MAIL", "Var.mail")]
    inputs = [
        in_table("adCpt", AD_HASH_COLS),
        in_table("etepLk", ETEP_HASH_COLS, {"SAM_LTRF_UPPER": "adCpt.SAM_UPPER"}, "FIRST_MATCH"),
    ]
    filt = "!Var.matricule.isEmpty() && !Var.mail.isEmpty() && Var.actif"
    return mapper(inputs, [out_table("out", out, filt)], vars_)


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
    nodes = [
        ldap("tLDAPInput_1", 64, 64, "context.LDAP_BASEDN",
             '"(|(employeeID=*)(&(objectCategory=person)(objectClass=user)))"', AD_COLS),
        node("tMap", "2.1", "tMap_1", 288, 64, [p("DIE_ON_ERROR", "true", "CHECK")],
             metadata("adDico", AD_HASH_COLS) + "\n" + tmap_ad()),
        hash_out("tHashOutput_1", 512, 64, AD_HASH_COLS),
        ldap("tLDAPInput_2", 64, 192, "context.LDAP_BASEDN_ETEP", '"(employeeID=*)"', ETEP_COLS),
        node("tMap", "2.1", "tMap_3", 288, 192, [p("DIE_ON_ERROR", "true", "CHECK")],
             metadata("etepDico", ETEP_HASH_COLS) + "\n" + tmap_etep()),
        hash_out("tHashOutput_2", 512, 192, ETEP_HASH_COLS),
        hash_in("tHashInput_1", 64, 352, "tHashOutput_1", AD_HASH_COLS),
        hash_in("tHashInput_2", 288, 480, "tHashOutput_2", ETEP_HASH_COLS),
        node("tMap", "2.1", "tMap_2", 288, 352, [p("DIE_ON_ERROR", "true", "CHECK")],
             metadata("out", OUT_COLS) + "\n" + tmap_resultat()),
        node("tFileOutputDelimited", "0.101", "tFileOutputDelimited_1", 544, 352, [
            p("FILENAME", 'context.OUTPUT_DIR + "/MatriculeMailAd.csv"', "FILE"),
            p("ROWSEPARATOR", '"\\n"'),
            p("FIELDSEPARATOR", '";"'),
            p("APPEND", "false", "CHECK"),
            p("INCLUDEHEADER", "true", "CHECK"),
            p("CSV_OPTION", "true", "CHECK"),
            p("ESCAPE_CHAR", '"\\""'),
            p("TEXT_ENCLOSURE", '"\\""'),
            p("CREATE", "true", "CHECK"),
            p("ENCODING", '"UTF-8"', "ENCODING_TYPE"),
            p("ENCODING:ENCODING_TYPE", "UTF-8", "TECHNICAL"),
        ], metadata("tFileOutputDelimited_1", OUT_COLS)),
    ]
    # lineStyle = id EConnectionType : FLOW_MAIN=0, ON_SUBJOB_OK=1, ON_COMPONENT_OK=3, FLOW_REF(lookup)=8
    connections = [
        connection("FLOW", "ad", 0, "tLDAPInput_1", "tMap_1", "ad"),
        connection("FLOW", "adDico", 0, "tMap_1", "tHashOutput_1", "adDico", metaname="adDico"),
        connection("SUBJOB_OK", "OnSubjobOk", 1, "tLDAPInput_1", "tLDAPInput_2", "OnSubjobOk1"),
        connection("FLOW", "etep", 0, "tLDAPInput_2", "tMap_3", "etep"),
        connection("FLOW", "etepDico", 0, "tMap_3", "tHashOutput_2", "etepDico", metaname="etepDico"),
        connection("SUBJOB_OK", "OnSubjobOk", 1, "tLDAPInput_2", "tHashInput_1", "OnSubjobOk2"),
        connection("FLOW", "adCpt", 0, "tHashInput_1", "tMap_2", "adCpt"),
        connection("FLOW", "etepLk", 8, "tHashInput_2", "tMap_2", "etepLk"),
        connection("FLOW", "out", 0, "tMap_2", "tFileOutputDelimited_1", "out", metaname="out"),
    ]
    subjobs = [subjob("tLDAPInput_1"), subjob("tLDAPInput_2"), subjob("tHashInput_1")]
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
  <TalendProperties:Property xmi:id="{prop_id}" id="{tid()}" label="{JOB}" purpose="Reprise de GetAgentEmail.ps1" description="Matricule + mail depuis Active Directory uniquement (employeeID, ETEP via SharedMailbox), export CSV MatriculeMailAd.csv. Sans Oracle ni SQL Server." creationDate="{now}" modificationDate="{now}" version="{VERSION}" statusCode="" item="{item_id}" displayName="{JOB}">
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
