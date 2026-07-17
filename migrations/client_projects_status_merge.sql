-- Statussen samengevoegd 17-07-2026 (zie docs/specs/2026-07-17-admin-pijplijn-statussen-rooster-design.md
-- in de monorepo): 'afgerond' dubbelde met 'live', 'akkoord' schoot altijd direct door
-- naar 'in_uitvoering'. De UI kent nu 7 statussen (admin-klantprojecten.js).
-- Statushistorie in stolkwebdesign_client_project_events blijft bewust ongemoeid;
-- oude statuswaarden renderen daar via de grijze fallback.

update stolkwebdesign_client_projects set status = 'live',          updated_at = now() where status = 'afgerond';
update stolkwebdesign_client_projects set status = 'in_uitvoering', updated_at = now() where status = 'akkoord';
