-- =====================================================================
-- IN37-2 / IT-19934 - Rapprochement financier
-- DDL de la BDD intermédiaire LTRF (Oracle)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Lignes de pièces (flux 1 non rapprochées + flux 2 rapprochées)
-- ID_RAPPRO_FI_AX : spec = NUMBER mais valeur "RBUKRS-GJAHR-BELNR"
--                   -> VARCHAR2(30) (point ouvert n°3)
-- ---------------------------------------------------------------------
CREATE TABLE T_RAPPRO_FI (
    ID_RAPPRO_FI_AX     VARCHAR2(30)   NOT NULL,  -- DocumentNumber
    ID_LIG_COMPTA       NUMBER         NOT NULL,  -- LineDocumentNumber (DOCLN)
    N_RAPPRO            VARCHAR2(11),             -- AUGBL (flux 2)
    D_EVENEMENT         DATE,                     -- BLDAT
    D_INTEGRATION       DATE,                     -- ACDOCA.TIMESTAMP
    D_COMPTABLE         DATE,                     -- BUDAT
    I_AGENT             VARCHAR2(6),              -- XREF3
    I_PV                CHAR(6),                  -- RG01
    I_DEPT_ACTIVITE     VARCHAR2(30),             -- RACCT
    TYP_PIECE           CHAR(2),                  -- BLART
    TYP_RAPPRO          VARCHAR2(40),             -- RG03 (transco intégration)
    TYP_FLUX            VARCHAR2(40),             -- RG03 (transco intégration)
    M_DEBIT             NUMBER,
    M_CREDIT            NUMBER,
    F_RAPPROCHE         VARCHAR2(1)    NOT NULL,  -- '0' / '1'
    F_ECART             VARCHAR2(1),              -- '0' / '1'
    MOTIF_ECART         VARCHAR2(40),
    MOTIF_IMPUTATION    VARCHAR2(40),
    NUM_DIF             VARCHAR2(45),             -- RG02
    D_EMISSION          DATE,                     -- RG02
    D_LIM_REP_DIF       DATE,                     -- RG00
    MODE_PAIEMENT       VARCHAR2(10),             -- SUBSTR(XREF2,5,3)
    DESCRIPTION         VARCHAR2(60),             -- SGTXT
    D_ENVOI             DATE,
    D_TRAITE            DATE,
    LITIGE_BANCAIRE     NUMBER,                   -- RG04
    IMPUTATION_GERANT   NUMBER,                   -- RG05
    FRAIS_CB            NUMBER,                   -- RG06
    DIFFERENCE_CHANGE   NUMBER,                   -- RG07
    SEQ_BATCH_ID        NUMBER(19),
    D_RAPPROCHEMENT     DATE,                     -- AUGDT
    CONSTRAINT PK_RAPPRO_FI PRIMARY KEY (ID_RAPPRO_FI_AX, ID_LIG_COMPTA, F_RAPPROCHE)
);

-- ---------------------------------------------------------------------
-- Annulations de rapprochement (flux 3)
-- Noms "ancien nommage" à confirmer pour RefDocOrg/Number/Item
-- ---------------------------------------------------------------------
CREATE TABLE T_RAPPRO_FI_ANNUL (
    ID_RAPPRO_FI_AX     VARCHAR2(30)   NOT NULL,
    ID_LIG_COMPTA       NUMBER         NOT NULL,
    REF_DOC_ORG         VARCHAR2(10),             -- AWORG (société + exercice)
    REF_DOC_NUMBER      VARCHAR2(20),             -- AWREF
    REF_DOC_ITEM        VARCHAR2(6),              -- AWITEM
    D_EVENEMENT         DATE,
    D_INTEGRATION       DATE,
    D_COMPTABLE         DATE,
    D_ENVOI             DATE,
    D_TRAITE            DATE,
    SEQ_BATCH_ID        NUMBER(19),
    CONSTRAINT PK_RAPPRO_FI_ANNUL PRIMARY KEY (ID_RAPPRO_FI_AX, ID_LIG_COMPTA)
);

-- ---------------------------------------------------------------------
-- RG03 - Transco type de pièce (gérée à l'intégration)
-- Codes YJ/FF utilisés à la sélection ; la spec cite XX/FI (point ouvert n°2)
-- ---------------------------------------------------------------------
CREATE TABLE T_TRANSCO_TYP_PIECE (
    TYP_PIECE   CHAR(2)       PRIMARY KEY,
    TYP_RAPPRO  VARCHAR2(40)  NOT NULL,
    TYP_FLUX    VARCHAR2(40)  NOT NULL
);
INSERT INTO T_TRANSCO_TYP_PIECE VALUES ('RB', 'VE_VI', 'VE');
INSERT INTO T_TRANSCO_TYP_PIECE VALUES ('ZR', 'VE_VI', 'VI');
INSERT INTO T_TRANSCO_TYP_PIECE VALUES ('YJ', 'PR_JU', 'PR');
INSERT INTO T_TRANSCO_TYP_PIECE VALUES ('FF', 'PR_JU', 'JU');

-- ---------------------------------------------------------------------
-- Pilotage du delta + journal d'exécution (§5 et §7 de la spec)
-- ---------------------------------------------------------------------
CREATE TABLE T_INTERFACE_DELTA (
    INTERFACE_ID      VARCHAR2(20)  PRIMARY KEY,
    LAST_SUCCESS_TS   NUMBER(15)    NOT NULL       -- format ACDOCA AAAAMMJJhhmmss
);
INSERT INTO T_INTERFACE_DELTA VALUES ('IN37-2', 20260101000000);

CREATE SEQUENCE SEQ_BATCH_IN37_2;

CREATE TABLE T_INTERFACE_LOG (
    SEQ_BATCH_ID      NUMBER(19)    PRIMARY KEY,
    INTERFACE_ID      VARCHAR2(20),
    TS_FROM           NUMBER(15),                  -- "Sélection du xxx"
    TS_TO             NUMBER(15),                  -- "... au yyy"
    COMPANY_CODES     VARCHAR2(200),
    TS_UPDATED        VARCHAR2(3),                 -- OUI / NON
    NB_SELECTED       NUMBER,
    NB_SUCCESS        NUMBER,
    NB_ERROR          NUMBER,
    D_START           DATE,
    D_END             DATE,
    STATUS            VARCHAR2(10),
    MESSAGE           VARCHAR2(4000)
);

-- Rejets (erreur de transco, etc.)
CREATE TABLE T_RAPPRO_FI_REJET (
    SEQ_BATCH_ID      NUMBER(19),
    ID_RAPPRO_FI_AX   VARCHAR2(30),
    ID_LIG_COMPTA     NUMBER,
    TYP_PIECE         CHAR(2),
    ERROR_MESSAGE     VARCHAR2(4000),
    D_REJET           DATE DEFAULT SYSDATE
);

COMMIT;
