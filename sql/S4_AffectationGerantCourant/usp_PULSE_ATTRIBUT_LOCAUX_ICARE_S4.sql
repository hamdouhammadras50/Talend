/* =============================================================================
   Ticket 52654 - Icare - Interface SAP Attributs : attributs locaux
   -----------------------------------------------------------------------------
   Procedure : dbo.usp_PULSE_ATTRIBUT_LOCAUX_ICARE_S4
   Usage     : source du job Talend qui alimente la table du sas S4
               S4_AffectationGerantCourant (traitement quotidien, en FULL).

   Demandes integrees (N. MANGANAS) :
     1. Code gerant = gerant EN POSTE au moment ou le traitement tourne.
        L'ancien filtre "b.dateFin = '9999-12-31'" est remplace par
        dateDebut <= @DateReference <= dateFin, ce qui ignore les
        affectations futures.
        Ex : PDV 1LAA, traitement le 16/10/2026
             - gerant 00000001 du 01/02/2025 au 31/10/2026  -> retenu
             - gerant 00000002 du 31/10/2026 au 31/12/9999  -> ignore (futur)
        Si plusieurs affectations couvrent la date (ex : jour de bascule
        31/10/2026, date de fin de l'une = date de debut de l'autre), on retient
        celle qui a commence le plus recemment (le nouveau gerant).
     2. CreatedAtUtc = date de lancement du traitement, IDENTIQUE sur toutes
        les lignes du lot (calculee une seule fois, ou passee par Talend).
     3. Surfaces restreintes a 2 chiffres apres le separateur decimal
        (DECIMAL(18,2), arrondi). On ne passe plus par FORMAT(...,'N2','fr-FR')
        qui renvoie du texte avec separateur de milliers.
     4. PDV sans gerant en poste a la date du traitement (ex : uniquement une
        affectation future) : REMONTE avec CodeGerant et DateDebAffectation
        vides (LEFT JOIN) - valide par N. MANGANAS.
     5. Date de reference = date LOCALE (heure de Paris) et non UTC, pour ne
        pas remonter le gerant de la veille si le job tourne apres minuit
        - valide par N. MANGANAS.
     6. "Pas de commit intermediaire" : la proc ne fait qu'un SELECT ; le
        chargement full de la table S4 est fait par Talend dans UNE seule
        transaction (voir README.md du meme dossier).

   Parametres :
     @CreatedAtUtc  : horodatage du lot (UTC). A passer depuis Talend
                      (date de lancement du job). NULL -> SYSUTCDATETIME().
     @DateReference : date a laquelle on cherche le gerant en poste.
                      NULL -> date du jour (heure locale du serveur).

   Exemple :
     EXEC dbo.usp_PULSE_ATTRIBUT_LOCAUX_ICARE_S4;
     EXEC dbo.usp_PULSE_ATTRIBUT_LOCAUX_ICARE_S4
          @CreatedAtUtc = '2026-10-16T04:00:00', @DateReference = '2026-10-16';
   ============================================================================= */
CREATE OR ALTER PROCEDURE dbo.usp_PULSE_ATTRIBUT_LOCAUX_ICARE_S4
    @CreatedAtUtc  DATETIME2(0) = NULL,
    @DateReference DATE         = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Une seule valeur pour tout le lot
    SET @CreatedAtUtc  = ISNULL(@CreatedAtUtc, CAST(SYSUTCDATETIME() AS DATETIME2(0)));
    SET @DateReference = ISNULL(@DateReference, CAST(GETDATE() AS DATE));

    WITH GerantCourant AS
    (
        SELECT
             g.pdv_
            ,g.gerant_
            ,g.dateDebut
            ,ROW_NUMBER() OVER (PARTITION BY g.pdv_
                                ORDER BY g.dateDebut DESC, g.dateFin DESC) AS rn
        FROM EBX_TR_PDV_GERANT_REF_PDV g
        WHERE g.dateDebut <= @DateReference
          AND ISNULL(g.dateFin, '9999-12-31') >= @DateReference
    )
    SELECT
         a.fichePrincipale_code                                            AS CodePDV
        ,a.fichePrincipale_steRattachFk_                                   AS Societe
        ,ISNULL(a.fichePrincipale_typeLicBoissFk_, '')                     AS CodeLicenceBoisson
        ,CAST(ROUND(TRY_CAST(a.architecture_surfaceAttenante AS DECIMAL(19,4)), 2)
              AS DECIMAL(18,2))                                            AS SurfAttenante
        ,CAST(ROUND(TRY_CAST(a.architecture_surfaceAutre AS DECIMAL(19,4)), 2)
              AS DECIMAL(18,2))                                            AS AutreSurf
        ,ISNULL(a.informationsCommerciales_tabac_codeDebitTabac, '')       AS CodeDebitTabac
        ,ISNULL(a.comptables_quatuorFk_, '')                               AS CodeQuatuor
        ,ISNULL(a.fichePrincipale_datesGrp_dtMigrationPulse, '')           AS DateMigrationPulse
        ,ISNULL(gc.gerant_, '')                                            AS CodeGerant
        ,ISNULL(gc.dateDebut, '')                                          AS DateDebAffectation
        ,ISNULL(a.informationsCommerciales_presse_codeNim, '')             AS CodeNim
        ,@CreatedAtUtc                                                     AS CreatedAtUtc
    FROM EBX_TE_PDV_REF_PDV a
    LEFT JOIN GerantCourant gc
           ON gc.pdv_ = a.fichePrincipale_code
          AND gc.rn   = 1  -- dans le ON (et non le WHERE) pour garder les PDV sans gerant
    WHERE a.fichePrincipale_statut_ NOT IN (1, 6, 7);
END
GO
