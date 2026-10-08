-- Extraction des commandes EDICOM (fournisseurs 47451 et 01811) envoyees depuis 24h.
-- Requete fournie par B. BUFFEL, avec :
--   * les colonnes de article_commande_envoi listees explicitement (au lieu de .*)
--     pour que l'ordre corresponde au schema Talend ;
--   * les dates converties en texte (format ISO) ;
--   * un tri complete par code_cmde / i_ligne_cmde pour un ordre stable des lignes.
select commande_envoi.code_cmde,
       code_pdv_fourn,
       i_pdv,
       numero_cmde,
       type_cmde,
       to_char(date_livraison_cmde, 'YYYY-MM-DD') as date_livraison_cmde,
       code_erp1_fourn,
       envoyee_cmde,
       to_char(date_envoi_cmde, 'YYYY-MM-DD HH24:MI:SS') as date_envoi_cmde,
       email_cmdes_fourn,
       libelle_site,
       adresse_site,
       telephone_site,
       adresse_livraison,
       nom_utilisateur,
       prenom_utilisateur,
       code_fourn,
       raison_sociale_fourn,
       to_char(date_cmde, 'YYYY-MM-DD') as date_cmde,
       total_cmde,
       i_gln_pdv,
       case when code_erp1_fourn = '47451' then '3013086500101'
            when code_erp1_fourn = '01811' then '3013097500114'
       end as i_gln_destinataire_de_cmde,
       article_commande_envoi.code_article_fourn_cmde,
       article_commande_envoi.code_erp1_article,
       article_commande_envoi.quantite_article_cmde,
       article_commande_envoi.tarif_article_cmde,
       article_commande_envoi.code_erp1_unite_consommation,
       article_commande_envoi.libelle_famille,
       article_commande_envoi.libelle_article_cmde,
       article_commande_envoi.libelle_unite_achat,
       article_commande_envoi.total_article_cmde,
       article_commande_envoi.code_article,
       article_commande_envoi.prix_vente_article_cmde,
       article_commande_envoi.pcb_article_cmde,
       article_commande_envoi.i_ligne_cmde,
       article_commande_envoi.i_ean,
       article_commande_envoi.n_multiple_commande,
       article_commande_envoi.i_operation,
       article_commande_envoi.l_operation
  from approdirect.commande_envoi
  join approdirect.article_commande_envoi
    on commande_envoi.code_cmde = article_commande_envoi.code_cmde
 where code_erp1_fourn in ('47451', '01811')
   and commande_envoi.date_envoi_cmde > sysdate - 1
 order by code_erp1_fourn, numero_cmde, commande_envoi.code_cmde, article_commande_envoi.i_ligne_cmde
