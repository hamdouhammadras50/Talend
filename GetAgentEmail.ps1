#DataBase
$db_user= 'REFERENTIEL'
[string]$db_password = ''
$db_instance = 'PRDORA-SCAN.ltrf.fr:1521/PROD'

Add-Type -Path "C:\Oracle\netstandard2.1\Oracle.ManagedDataAccess.dll";

$ExitCode = 0
$connectionString = "User Id=$db_user;Password=$db_password ;Data Source=$db_instance";

$query = @"
SELECT ag.i_agent,
       ag.c_etat,
       ag.l_etat,
       ag.l_civilite_nom,
       ag.l_email_ad,
       ag.mail_disponible,
       ag.i_societe 
  FROM referentiel.agent ag
 WHERE 1=1
 --AND ag.i_societe <> '16'
 --AND ag.i_agent in (241653, 880022)
 --AND rownum <= 100
"@

$UpdateQuery = @"
/*UPDATE referentiel.agent ag
   SET ag.l_email_ad = :pl_email_ad,
       ag.mail_disponible = :pmail_disponible 
 WHERE 1=1
AND ag.i_agent = :pi_agent*/
"@

$RootOUGerant = "DC=ltrf,DC=fr" #"OU=HorsSiege,DC=ltrf,DC=fr"
$RootOUSharedMailBox = "OU=SharedMailbox,OU=Office365,OU=AppGroups,OU=SiegeLTRF,DC=ltrf,DC=fr" #"OU=SharedMailbox"

$Searcher = New-Object DirectoryServices.DirectorySearcher
$Searcher.SearchRoot = New-Object System.DirectoryServices.DirectoryEntry("LDAP://$($RootOUGerant)")
$searcher.PropertiesToLoad.Add("employeeID");
$searcher.PropertiesToLoad.Add("userPrincipalName");
$searcher.PropertiesToLoad.Add("userAccountControl");
$searcher.PropertiesToLoad.Add("description");
$searcher.PropertiesToLoad.Add("mail");
$searcher.PropertiesToLoad.Add("Path");
$searcher.PropertiesToLoad.Add("sAMAccountName");

$SearcherEtep = New-Object DirectoryServices.DirectorySearcher
$SearcherEtep.SearchRoot = New-Object System.DirectoryServices.DirectoryEntry("LDAP://$($RootOUSharedMailBox)")
$SearcherEtep.PropertiesToLoad.Add("employeeID");
$SearcherEtep.PropertiesToLoad.Add("sAMAccountName");

# $users = Import-Csv -Path .\20240531_AgentOracle.csv -Delimiter ';'  -Encoding ansi | Where-Object { $_.L_EMAIL_AD -ne $null -and $_.L_EMAIL_AD -ne ''}
try {
    $oracleConnection = New-Object Oracle.ManagedDataAccess.Client.OracleConnection($connectionString);
    
    $cmd = $oracleConnection.CreateCommand();
    $cmd.CommandText = $query;

    $cmdUpdate = $oracleConnection.CreateCommand();
    $cmdUpdate.CommandText = $UpdateQuery;
    
    $cmdUpdate.Parameters.Add("pl_email_ad", [Oracle.ManagedDataAccess.Client.OracleDbType]::NVarchar2)
    $cmdUpdate.Parameters["pl_email_ad"].Direction = [System.Data.ParameterDirection]::Input
    $cmdUpdate.Parameters.Add("pmail_disponible", [Oracle.ManagedDataAccess.Client.OracleDbType]::NVarchar2)
    $cmdUpdate.Parameters["pmail_disponible"].Direction = [System.Data.ParameterDirection]::Input
    $cmdUpdate.Parameters.Add("pi_agent", [Oracle.ManagedDataAccess.Client.OracleDbType]::NVarchar2)
    $cmdUpdate.Parameters["pi_agent"].Direction = [System.Data.ParameterDirection]::Input
    
    $oracleConnection.Open();

    $reader = $cmd.ExecuteReader() ;


    while ($reader.Read()) {
        #reset variables
        $AdStatus = $null
        $AdEmployeeID = $null
        $AduserPrincipalName = $null
        $AduserAccountControl = $null
        $AdPath = $null
        $AdDescription = $null
        $AdMail = $null
        $Admail_disponible = $null

        $vi_agent = $reader.GetString($reader.GetOrdinal("i_agent"))
        $vc_etat = $reader.IsDBNull($reader.GetOrdinal("c_etat")) ? '': $reader.GetString($reader.GetOrdinal("c_etat"))
        $vl_etat = $reader.IsDBNull($reader.GetOrdinal("l_etat")) ? '': $reader.GetString($reader.GetOrdinal("l_etat"))
        $vl_civilite_nom = $reader.IsDBNull($reader.GetOrdinal("l_civilite_nom")) ? '': $reader.GetString($reader.GetOrdinal("l_civilite_nom"))
        $vl_email_ad = $reader.IsDBNull($reader.GetOrdinal("l_email_ad")) ? '': $reader.GetString($reader.GetOrdinal("l_email_ad"))
        $vmail_disponible = $reader.IsDBNull($reader.GetOrdinal("mail_disponible")) ? '': $reader.GetString($reader.GetOrdinal("mail_disponible"))
        $vi_societe = $reader.IsDBNull($reader.GetOrdinal("i_societe")) ? '': $reader.GetString($reader.GetOrdinal("i_societe"))
        
        $Filter = "(employeeID=$($vi_agent.PadLeft(8, '0')))"

        if($vi_societe -eq '16'){
            $SearcherEtep.Filter = $Filter
            $res = $SearcherEtep.FindOne()
            if($res){
                #search LTRF account by sameccountname
                $AdsAMAccountName = $res.Properties["sAMAccountName"][0]
                $AdsAMAccountNameLTRF = $AdsAMAccountName -replace '_ETEP', ''
                $Filter = "(sAMAccountName=$AdsAMAccountNameLTRF)"
                $Searcher.Filter = $Filter
                $res = $Searcher.FindOne()               

            }
        }else {
            $Searcher.Filter = $Filter
            $res = $Searcher.FindOne()
        }

        if($res){
             $AdStatus = 'Found by EmployeID'
             $AdEmployeeID = $res.Properties["employeeID"][0]
             $AduserPrincipalName = $res.Properties["userPrincipalName"][0]
             $AduserAccountControl = $res.Properties["userAccountControl"][0]
             $AdPath = $res.Path
             $AdDescription = $res.Properties["description"][0]      
             $AdMail = $res.Properties["mail"][0]     
             $Admail_disponible = $($(-not ($AduserAccountControl -band 2) -eq 2 )?'O':'N')
        } else {
            $AdMail = ''
            $Admail_disponible = ''
        }

        # $CurrDateStr = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        # Add-Content -Path $logfilepath -Value "$CurrDateStr : $UserAccount : $(($Success -eq 1) ? 'OK' : 'KO')"
        $user = New-Object PSObject

        $user | Add-Member -MemberType NoteProperty -Name "I_agent" -Value $vi_agent
        $user | Add-Member -MemberType NoteProperty -Name "c_etat" -Value $vc_etat
        $user | Add-Member -MemberType NoteProperty -Name "l_etat" -Value $vl_etat
        $user | Add-Member -MemberType NoteProperty -Name "l_civilite_nom" -Value $vl_civilite_nom
        $user | Add-Member -MemberType NoteProperty -Name "i_societe" -Value $vi_societe
        $user | Add-Member -MemberType NoteProperty -Name "l_email_ad" -Value $vl_email_ad
        $user | Add-Member -MemberType NoteProperty -Name "mail_disponible" -Value $vmail_disponible
    
        $user | Add-Member -MemberType NoteProperty -Name "AdStatus" -Value $AdStatus
        $user | Add-Member -MemberType NoteProperty -Name "AdEmployeeID" -Value $AdEmployeeID
        $user | Add-Member -MemberType NoteProperty -Name "AduserPrincipalName" -Value $AduserPrincipalName
        $user | Add-Member -MemberType NoteProperty -Name "AduserAccountControl" -Value $AduserAccountControl
        $user | Add-Member -MemberType NoteProperty -Name "AdPath" -Value $AdPath
        $user | Add-Member -MemberType NoteProperty -Name "AdDescription" -Value $AdDescription
        $user | Add-Member -MemberType NoteProperty -Name "AdMail" -Value $AdMail
        $user | Add-Member -MemberType NoteProperty -Name "Admail_disponible" -Value $Admail_disponible
    
        $user | Export-Csv -Append -Encoding utf8NoBOM -Path .\OracleAgentCompletedByAd.csv         
    }
    
    $reader.Close()

}
Catch {
    $err = Get-Error;
    $err;
    $ExitCode = 2;
}
finally {
    if ($oracleConnection.State -eq 'Open') { $oracleConnection.close() }          
    Write-Host "Exit code: $ExitCode";
}

