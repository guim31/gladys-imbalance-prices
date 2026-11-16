# Prix de déséquilibre (Elia, TenneT)

## Ce que fait l'intégration

Le prix de déséquilibre règle, pour chaque quart d'heure, l'écart entre ce que
le réseau électrique avait prévu et ce qui s'est réellement passé. Certains
contrats dynamiques en Belgique et aux Pays-Bas le répercutent à leurs clients
(contrats « imbalance », batteries domestiques pilotées dessus). Cette
intégration l'amène dans Gladys en quasi temps réel :

- **Belgique**, par Elia Open Data : le prix du quart d'heure en cours, estimé
  minute par minute, et la valeur définitive de chaque quart d'heure clos ;
- **Pays-Bas**, par l'API TenneT : un prix indicatif calculé à partir de
  l'énergie d'équilibrage activée par TenneT, chaque minute.

Elle ne couvre que le prix de déséquilibre. Pour les prix day-ahead (EPEX,
ENTSO-E) ou le tarif d'un fournisseur, utilisez les intégrations prévues pour.

## Prérequis

- Gladys 5.3.0 ou plus récent.
- Un accès Internet depuis Gladys (opendata.elia.be, api.tennet.eu).
- Pour les Pays-Bas seulement : une clé API TenneT gratuite. Inscrivez-vous sur
  [developer.tennet.eu](https://developer.tennet.eu/register/), puis créez une
  clé dans votre compte. La Belgique ne demande aucun compte.

## Installation

1. Dans Gladys, ouvrez **Intégrations → Installer depuis GitHub**.
2. Saisissez `https://github.com/guim31/gladys-imbalance-prices` et installez.

## Configuration

- **Belgique (Elia)** : cochée par défaut.
- **Clé API TenneT (Pays-Bas)** : laissez-la vide pour ne pas suivre les
  Pays-Bas.
- **Langue des noms** : langue des noms de fonctionnalités et du sens du
  déséquilibre, fixée à l'ajout d'un appareil (français par défaut).

Ouvrez ensuite l'onglet **Découverte** et ajoutez les appareils : un par zone.
L'action **Relever les prix maintenant** interroge les deux sources et affiche
le prix du quart d'heure en cours : pratique pour vérifier une clé TenneT.

## Appareils

Chaque zone est un appareil avec ces fonctionnalités :

| Fonctionnalité                       | Signification                                                       |
| ------------------------------------ | ------------------------------------------------------------------- |
| Prix du quart d'heure (€/MWh)        | prix du quart d'heure en cours, mis à jour chaque minute            |
| Prix du quart d'heure (€/kWh)        | le même, divisé par 1 000                                           |
| Prix quart d'heure précédent (€/MWh) | prix du quart d'heure qui vient de se terminer                      |
| Déséquilibre du système (MW)         | positif : la zone est en surplus ; négatif : elle manque de courant |
| Sens du déséquilibre                 | Surplus, Déficit ou Équilibre                                       |
| Quart d'heure en cours               | début du quart d'heure en cours, heure de Bruxelles ("14:15")       |

Gladys n'a ni unité €/MWh ni unité MW : les noms des fonctionnalités les
portent. Un prix négatif signifie que consommer pendant ce quart d'heure est
rémunéré.

## Scènes

Deux déclencheurs, dans la catégorie **Intégrations** de l'éditeur de scènes :

- **Le prix de déséquilibre devient négatif** : le prix estimé du quart
  d'heure en cours passe sous 0 €/MWh.
- **Le prix de déséquilibre dépasse un seuil** : il passe au-dessus de 100,
  150, 200, 300, 500 ou 1 000 €/MWh.

Les deux peuvent se limiter à une zone (vide : les deux zones). Chacun se
déclenche quand le prix franchit la limite, une fois par quart d'heure au plus,
et pas de nouveau tant que le prix reste du même côté. Les actions suivantes
peuvent lire `{{triggerEvent.data.price}}` (€/MWh), `price_kwh`, `zone` et
`quarter_hour`. Pour arrêter un appareil quand le prix remonte, utilisez le
déclencheur de l'appareil (« Prix du quart d'heure (€/MWh) ≥ 0 »).

## Tableau de bord

Le widget **Prix de déséquilibre** affiche, par zone, le prix du quart d'heure
en cours, le précédent, le déséquilibre du système et la courbe du jour (que
l'on peut masquer dans les réglages du widget).

## Sources de données et limites

- **Elia** : jeux `ods161` (par minute) et `ods162` (par quart d'heure)
  d'[Elia Open Data](https://opendata.elia.be), lus une fois par minute, et une
  fois par quart d'heure pour les quarts d'heure clos. La valeur en cours est
  une estimation sur les minutes écoulées ; celle de la minute 14 est la valeur
  publiée. Elia marque ces données « non validées » : le prix réglé peut encore
  changer.
- **TenneT** : « Balance Delta High Res » (`/latest`), lu une fois par minute
  (usage loyal : 10 par minute au plus). Le prix est calculé comme l'état de
  régulation de TenneT : régulation à la hausse seule → prix à la hausse le
  plus haut, à la baisse seule → prix à la baisse le plus bas, les deux → prix
  du sens net, aucune → prix médian. Il est indicatif : le prix réglé que
  TenneT publie plus tard peut différer. La courbe du jour ne commence qu'au
  démarrage de l'intégration.
- **Développé sans clé TenneT : vos retours sont les bienvenus.** La partie
  néerlandaise suit la description de l'API de TenneT ; elle n'a pas pu être
  testée contre la vraie API.
- Les heures suivent l'horloge de Bruxelles et d'Amsterdam, quel que soit le
  fuseau de Gladys.

## Dépannage

- L'intégration est affichée en erreur : son message dit quelle source fait
  défaut (Elia injoignable, clé TenneT refusée, TenneT injoignable). Les
  dernières valeurs restent sur les appareils.
- Aucune valeur sur un appareil : il doit être ajouté depuis l'onglet
  **Découverte** ; les premières valeurs arrivent dans la minute.
- Journaux : la page de l'intégration dans Gladys ; `LOG_LEVEL=debug` montre
  chaque lecture.

## Crédits

Données : [Elia Open Data](https://opendata.elia.be) (Elia Transmission
Belgium) et l'[API TenneT](https://developer.tennet.eu) (TenneT TSO B.V.).
Cette intégration n'a aucun lien avec Elia ni TenneT.
