# Guide des Tests E2E - DojoKai

Ce document explique comment lancer et gérer les tests de bout en bout (E2E) pour l'application DojoKai.

## Structure des Tests

Les tests sont situés dans le dossier `dojoApp-e2e/tests`.

- `01-student-crud.spec.js` : Gestion complète des élèves (Création, Modification, Suppression).
- `03-payment-workflow.spec.js` : Workflow des paiements, dettes et relances.
- `04-document-workflow.spec.js` : Workflow documentaire avec **Mock Google Drive API**.
- `05-group-management.spec.js` : Création de groupes et filtrage.

## Lancement des tests en local

1. Naviguer dans le dossier : `cd dojoApp-e2e`
2. Tout lancer : `npx playwright test`
3. Lancer un test spécifique : `npx playwright test tests/04-document-workflow.spec.js`
4. Lancer avec UI : `npx playwright test --ui`

## Intégration CI/CD et Déploiement

Les tests E2E sont intégrés au flux de déploiement via GitHub Actions.

### Workflow de Déploiement (`dojoApp/.github/workflows/deploy.yml`)

Lors d'un push sur `master`, l'application est déployée sur le VPS. 
Vous pouvez déclencher les tests E2E sur l'environnement de production manuellement via l'onglet **Actions** de GitHub :

1. Aller sur le workflow **Deploy to VPS**.
2. Cliquer sur **Run workflow**.
3. Cocher la case **Lancer les tests E2E (Externe)?**.

Ceci enverra un signal au dépôt `dojoApp-e2e` pour exécuter les tests contre l'URL `https://dojokai.com`.

### Workflow Interne E2E (`dojoApp-e2e/.github/workflows/run-e2e-dispatch.yml`)

Ce workflow reçoit les requêtes de `deploy.yml` et lance les tests Playwright dans le cloud. Il utilise les secrets `E2E_USER_EMAIL` et `E2E_USER_PASSWORD` pour se connecter.

## Mocking Google Drive

Le test `04-document-workflow.spec.js` utilise un système de mocking réseau pour simuler l'API Google Drive. Cela permet de tester l'UI et la logique d'upload sans dépendre d'un compte Google réel ou de quotas API.

```javascript
await page.route('**', async route => {
    // Intercepts googleapis.com and fulfills with mock data
});
```

---
Dernière mise à jour : 10 Janvier 2026
