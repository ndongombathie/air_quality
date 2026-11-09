# ruff: noqa: E501  (textes éditoriaux : un paragraphe par ligne)
"""
Articles éditoriaux de démonstration, rédigés à partir des mesures réelles du réseau SEN-AIR
(historique du 6 au 8 juillet 2026 et flux du 3 novembre 2026).

Chaque article a une photo libre de droits (Wikimedia Commons) rangée dans `seed_media/`,
avec son auteur et sa licence dans `seed_media/credits.json`. Le crédit est ajouté en fin d'article.
"""

from dataclasses import dataclass
from datetime import UTC, datetime


def at(day: str, hour: int = 9) -> datetime:
    return datetime.fromisoformat(day).replace(hour=hour, tzinfo=UTC)


@dataclass(frozen=True)
class SeedArticle:
    slug: str
    title: str
    excerpt: str
    content: str
    category: str
    published_at: datetime
    photo: str
    alt: str
    tags: tuple[str, ...] = ()
    featured: bool = False
    author: str = "Équipe SEN-AIR"
    role: str = "Rédaction"


ARTICLES: tuple[SeedArticle, ...] = (
    SeedArticle(
        slug="bilan-premieres-mesures-juillet-2026",
        title="Premières mesures du réseau : le bilan du 6 au 8 juillet 2026",
        excerpt="2 108 relevés sur 9 stations en trois jours. Les particules fines restent proches de la valeur guide de l'OMS, avec de fortes différences entre quartiers.",
        content="""## Trois jours, neuf stations

Du 6 au 8 juillet 2026, les capteurs SEN-AIR installés dans les écoles, lycées et bâtiments publics de Thiès ont transmis **2 108 relevés**. Il faisait en moyenne **31 °C**, avec **71 % d'humidité** et un vent de **4,9 m/s**.

## Les particules fines (PM2.5)

En laissant de côté les trois relevés exceptionnels de l'Hôtel de Ville (voir notre article sur la station de l'Hôtel de Ville), la moyenne des PM2.5 sur la ville est de **13,2 µg/m³**, juste sous la valeur guide journalière de l'OMS (15 µg/m³).

Moyenne par station :

- **Médina Fall** : 17,6 µg/m³
- **Lycée Malick Sy** : 16,3 µg/m³
- **Jules Sagna** : 16,1 µg/m³
- **Sud Stade** : 14,8 µg/m³
- **Cité Lamy** : 14,6 µg/m³
- **Fahu** : 14,1 µg/m³
- **Kaba Sall** : 13,9 µg/m³
- **Université Iba Der Thiam** : 9,8 µg/m³

## Ce qu'il faut retenir

- Trois stations dépassent en moyenne la valeur guide de l'OMS : Médina Fall, Malick Sy et Jules Sagna.
- L'Université Iba Der Thiam a l'air le moins chargé en particules fines, mais enregistre beaucoup de poussières plus grosses (PM10 : 56,7 µg/m³ en moyenne), sans doute soulevées par le vent sur les sols nus.
- Trois jours ne suffisent pas pour parler de tendance : ce bilan sera complété chaque mois.""",
        category="report",
        published_at=at("2026-07-09", 10),
        photo="bilan-juillet",
        alt="Route de latérite longeant le mur du lycée de Fahu, à Thiès",
        tags=("bilan", "pm25", "juillet"),
        role="Analyste données",
    ),
    SeedArticle(
        slug="hotel-de-ville-releves-exceptionnels-juillet",
        title="Hôtel de Ville : des relevés exceptionnels trois jours de suite",
        excerpt="Entre 185 et 205 µg/m³ de PM2.5 en plein centre-ville, plus de 12 fois la valeur guide de l'OMS. Ce que l'on sait et ce qui reste à vérifier.",
        content="""## Ce qui a été mesuré

La station de l'**Hôtel de Ville** n'a transmis qu'un relevé par jour du 6 au 8 juillet 2026, toujours vers 13 h, et chacun est très élevé :

- **6 juillet** : 205,1 µg/m³ de PM2.5
- **7 juillet** : 184,8 µg/m³
- **8 juillet** : 196,6 µg/m³

Au même moment, les autres stations de la ville restaient autour de 13 µg/m³.

## Pollution réelle ou capteur à vérifier ?

Deux hypothèses sont étudiées :

- **une source très proche** : fumée de cuisson, déchets brûlés, moteur au ralenti juste à côté du capteur ;
- **un problème de mesure** : capteur encrassé ou exposé directement à une source, ce qui arrive avec les appareils de mesure optique. Le fait que la station n'envoie qu'un relevé par jour, contre une centaine pour ses voisines, renforce cette piste.

Les PM2.5 et les PM10 ont presque la même valeur. Cela correspond plutôt à une fumée (particules très fines) qu'à de la poussière soulevée par le vent.

## Ce que nous faisons

- Une visite du capteur est prévue pour vérifier son emplacement et son état.
- Les relevés restent visibles dans l'historique, signalés comme exceptionnels.
- La liaison Wi-Fi de la station sera contrôlée pour rétablir un envoi régulier.
- Si un pic semblable se reproduit, une alerte sera envoyée aux habitants du centre-ville abonnés.

## Si vous étiez sur place

Une exposition de quelques heures à ce niveau peut irriter les yeux et la gorge, surtout chez les personnes asthmatiques. En cas de gêne respiratoire qui persiste, consultez un médecin.""",
        category="alert",
        published_at=at("2026-07-09", 14),
        photo="episode-7-juillet",
        alt="Carrefour et voie ferrée en centre-ville de Thiès, sous un ciel dégagé",
        tags=("pm25", "centre-ville", "hôtel de ville"),
    ),
    SeedArticle(
        slug="point-qualite-air-3-novembre-2026",
        title="Point du 3 novembre : Jules Sagna et le centre-ville au-dessus des seuils",
        excerpt="Avec le retour de la saison sèche, les particules fines remontent. Quatre stations dépassent la valeur guide de l'OMS sur la journée.",
        content="""## La journée en chiffres

Entre 1 h et 19 h ce 3 novembre 2026, le réseau a reçu plus de **2 400 relevés**. Moyenne des PM2.5 par station :

- **Jules Sagna** : 29,0 µg/m³ (pic à 132,5 µg/m³)
- **Hôtel de Ville** : 24,3 µg/m³
- **Médina Fall** : 22,3 µg/m³
- **Lycée Malick Sy** : 17,5 µg/m³
- **Sud Stade** : 14,9 µg/m³
- **Fahu** : 13,7 µg/m³
- **Université Iba Der Thiam** : 11,6 µg/m³

## Lecture

Quatre stations dépassent la valeur guide journalière de l'OMS (15 µg/m³) et **Jules Sagna** dépasse aussi le seuil national retenu dans SEN-AIR (25 µg/m³). Les stations situées le long des grands axes (Jules Sagna, Hôtel de Ville) et la zone de Médina Fall sont les plus touchées.

## Conseils pour les prochains jours

- Aérez votre logement tôt le matin, quand l'air est le moins chargé.
- Si vous êtes sensible (asthme, problèmes cardiaques, grossesse), évitez les efforts près des axes routiers.
- Activez les alertes de votre quartier dans l'application pour être prévenu en cas de pic.""",
        category="report",
        published_at=at("2026-11-03", 19),
        photo="point-novembre",
        alt="Façade de la gare ferroviaire de Thiès avec des voitures garées devant",
        tags=("bilan", "novembre", "pm25"),
        featured=True,
        role="Analyste données",
    ),
    SeedArticle(
        slug="centre-ville-pourquoi-plus-expose",
        title="Pourquoi le centre-ville respire un air plus chargé",
        excerpt="Trafic, marchés, cuisson en plein air : le cœur de Thiès cumule les sources de particules fines. Explications à partir de nos mesures.",
        content="""## Ce que montrent les capteurs

Depuis le début des mesures, les stations du centre (**Hôtel de Ville**, **Jules Sagna**) et de **Médina Fall** ont les moyennes de PM2.5 les plus élevées du réseau. Le 3 novembre, Jules Sagna atteignait 29 µg/m³ en moyenne, contre 11,6 µg/m³ à l'Université Iba Der Thiam.

## Les sources principales

- **Le trafic** : les vieux véhicules diesel, les taxis et les motos au ralenti aux carrefours émettent des particules très fines.
- **Les marchés** : la cuisson au charbon de bois et les déchets brûlés en fin de journée.
- **La poussière** : les routes non bitumées et les chantiers soulèvent des PM10 dès que le vent se lève.
- **Le bâti dense** : les rues étroites gardent la pollution, qui se disperse moins bien qu'en périphérie.

## Que faire quand on vit ou travaille au centre ?

- Préférez les rues secondaires aux grands axes pour marcher.
- Fermez les fenêtres côté rue aux heures de pointe.
- Commerçants et vendeurs en plein air : faites des pauses à l'intérieur quand l'indice est élevé.""",
        category="info",
        published_at=at("2026-10-28", 9),
        photo="centre-ville",
        alt="Rue animée du marché de Thiès, avec des étals de vêtements et des passants",
        tags=("centre-ville", "trafic", "pm25"),
    ),
    SeedArticle(
        slug="heures-air-le-plus-charge",
        title="Matin et soir : les heures où l'air est le plus chargé",
        excerpt="Nos capteurs montrent deux moments à éviter pour le sport et l'aération : le début de matinée et la soirée.",
        content="""## Ce que disent les mesures heure par heure

En regroupant tous les relevés du réseau par heure de la journée, deux pics apparaissent :

- **Entre 7 h et 9 h** : les PM2.5 montent à près de 20 µg/m³, contre 11 µg/m³ la nuit. C'est l'heure des trajets vers l'école et le travail, et des premiers feux de cuisson.
- **Entre 19 h et 23 h** : les PM10 grimpent jusqu'à 37 µg/m³. Le trafic du soir, la cuisson du dîner et l'air plus calme qui retient les poussières se cumulent.

L'air est le plus propre **la nuit et en fin de nuit, entre 1 h et 5 h**.

## Adapter ses habitudes

- **Aérer** : ouvrez les fenêtres tôt, avant 7 h.
- **Faire du sport** : privilégiez le milieu d'après-midi ou le tout début de matinée.
- **Les enfants** : évitez les longues attentes au bord de la route aux heures d'entrée et de sortie des classes.

## Attention

Ces moyennes cachent des écarts selon les quartiers et les saisons. Consultez l'indice de votre quartier dans l'application avant de sortir.""",
        category="education",
        published_at=at("2026-10-21", 8),
        photo="heures-pointe",
        alt="Taxis et voitures garés le long d'une rue en terre, devant des immeubles",
        tags=("trafic", "conseils", "horaires"),
    ),
    SeedArticle(
        slug="masques-lequel-choisir-poussieres",
        title="Poussières et fumées : quel masque protège vraiment ?",
        excerpt="Masque en tissu, chirurgical ou FFP2 : ils ne filtrent pas tous les particules fines. Le point avant la saison de l'harmattan.",
        content="""## Pourquoi c'est important

Pendant l'harmattan, de novembre à mars, les PM10 peuvent dépasser plusieurs fois la valeur guide de l'OMS (45 µg/m³ sur 24 h). Les particules les plus fines, les PM2.5, passent à travers la plupart des tissus.

## Les différents masques

- **Foulard ou masque en tissu** : arrête les grosses poussières, mais très peu les particules fines. Utile contre le sable, insuffisant contre la pollution.
- **Masque chirurgical** : mieux que le tissu, mais l'air passe par les côtés.
- **Masque FFP2 (ou N95, KN95)** : filtre au moins 94 % des particules fines s'il est bien ajusté. C'est le seul vraiment efficace.

## Bien le porter

- Pincez la barrette sur le nez et vérifiez qu'il n'y a pas de fuite sur les côtés.
- Changez-le dès qu'il est humide, sale ou abîmé.
- Une barbe empêche une bonne étanchéité.

## À savoir

Le masque est une protection d'appoint. Il est déconseillé aux jeunes enfants et peut gêner les personnes qui ont des difficultés respiratoires : demandez conseil à un soignant. Rester à l'intérieur fenêtres fermées pendant les pics reste la meilleure protection.""",
        category="education",
        published_at=at("2026-10-30", 9),
        photo="masques",
        alt="Rue d'une ville sénégalaise noyée dans la poussière orangée de l'harmattan",
        tags=("harmattan", "pm10", "masque"),
        featured=True,
    ),
    SeedArticle(
        slug="asthme-pollution-bons-reflexes",
        title="Asthme et pollution de l'air : les bons réflexes",
        excerpt="Les particules fines peuvent déclencher des crises. Comment utiliser l'indice SEN-AIR pour anticiper et se protéger.",
        content="""## Pourquoi les asthmatiques sont plus exposés

Les particules fines (PM2.5) et l'ozone irritent les bronches. Chez une personne asthmatique, elles peuvent provoquer toux, sifflements et crises, parfois plusieurs heures après l'exposition.

## Avant de sortir

- Consultez l'indice de votre quartier dans l'application.
- Dans votre profil, choisissez le profil **Asthme** : les conseils santé seront adaptés.
- Activez les alertes à partir du niveau **Mauvais pour les groupes sensibles**.

## Pendant un épisode de pollution

- Gardez toujours votre traitement de crise sur vous.
- Évitez les efforts intenses en extérieur et les abords des grands axes.
- Fermez les fenêtres aux heures chargées (matin et soir) et aérez tôt le matin.
- Évitez aussi les fumées à l'intérieur : encens, charbon, cigarette.

## Quand consulter

Si vous utilisez votre traitement de crise plus souvent que d'habitude, si la gêne ne passe pas ou si vous avez du mal à parler, consultez rapidement un médecin ou rendez-vous aux urgences.

SEN-AIR donne des informations de prévention et ne remplace pas l'avis d'un professionnel de santé.""",
        category="education",
        published_at=at("2026-10-14", 9),
        photo="asthme",
        alt="Inhalateur de traitement de l'asthme posé sur une table",
        tags=("santé", "asthme", "conseils"),
        author="Équipe SEN-AIR",
        role="Prévention santé",
    ),
    SeedArticle(
        slug="ecoles-proteger-les-enfants",
        title="Sept établissements scolaires équipés : protéger les enfants de la pollution",
        excerpt="7 des 9 capteurs SEN-AIR sont installés dans des écoles, collèges et lycées. Les enfants sont parmi les plus sensibles à la pollution.",
        content="""## Des capteurs là où sont les enfants

Sur les 9 stations du réseau, 7 sont installées dans des établissements scolaires : école élémentaire Sud Stade, école élémentaire Kaba Sall, lycée Malick Sy, lycée Jules Sagna, lycée Médina Fall, lycée de Fahu et collège Cité Lamy. Les élèves et les enseignants peuvent ainsi suivre l'air qu'ils respirent chaque jour.

## Pourquoi les enfants sont plus sensibles

- Ils respirent plus vite que les adultes et inhalent donc plus d'air pour leur poids.
- Leurs poumons se développent jusqu'à l'adolescence.
- Ils jouent dehors et près du sol, là où les poussières sont soulevées.

## Conseils pour les écoles

- Quand l'indice est **mauvais**, organisez la récréation et le sport à l'intérieur ou réduisez leur intensité.
- Aérez les classes tôt le matin, avant l'arrivée du trafic.
- Évitez de brûler les déchets ou les feuilles dans la cour.
- Affichez l'indice du jour à l'entrée : c'est aussi un bon support pédagogique.

## Conseils pour les parents

Un enfant qui tousse, se plaint de la gorge ou s'essouffle plus que d'habitude pendant un épisode de pollution doit être surveillé, surtout s'il est asthmatique.""",
        category="education",
        published_at=at("2026-10-07", 9),
        photo="enfants",
        alt="Défilé d'élèves des écoles élémentaires de Thiès dans une rue ombragée",
        tags=("enfants", "écoles", "santé"),
    ),
    SeedArticle(
        slug="comment-fonctionnent-capteurs-senair",
        title="Comment fonctionnent les capteurs du réseau SEN-AIR",
        excerpt="Un laser pour compter les particules, un relevé par minute, une transmission en direct : visite guidée d'une station de mesure.",
        content="""## Ce que mesure une station

Chaque station AirGradient du réseau mesure :

- les **particules fines (PM2.5)** et les **particules (PM10)** ;
- le **CO₂** et les **composés organiques volatils (COV)** ;
- la **température** et l'**humidité**.

Les gaz (NO₂, SO₂, O₃, CO) et le vent viennent d'OpenWeatherMap, à l'échelle de la ville.

## Le principe de mesure

L'air est aspiré par un petit ventilateur et traverse un faisceau laser. Chaque particule diffuse un peu de lumière : le capteur compte ces éclats et estime la quantité de particules selon leur taille. C'est une **mesure optique**, peu coûteuse, qui permet d'équiper beaucoup de quartiers.

## Du capteur à votre téléphone

- La station envoie ses relevés par Wi-Fi.
- Le pipeline de données les vérifie, les complète avec la météo et les publie en continu.
- La plateforme SEN-AIR calcule l'indice de qualité de l'air, déclenche les alertes et met à jour la carte.

## Les limites à connaître

- Quand l'humidité dépasse 70 à 80 %, les gouttelettes peuvent être comptées comme des particules : les valeurs sont alors surestimées.
- Un capteur peut tomber en panne ou s'encrasser. Les valeurs anormales sont signalées et vérifiées sur place.
- Ces capteurs complètent, sans les remplacer, les stations de référence officielles.""",
        category="info",
        published_at=at("2026-07-03", 9),
        photo="capteurs",
        alt="Station de mesure de la qualité de l'air avec plusieurs capteurs sur un mât",
        tags=("capteurs", "méthode", "airgradient"),
        role="Équipe technique",
    ),
    SeedArticle(
        slug="maintenance-capteur-kaba-sall",
        title="Maintenance : le capteur de particules de Kaba Sall ne transmet plus",
        excerpt="Depuis début novembre, la station Kaba Sall n'envoie plus de mesures de particules. La température et l'humidité restent disponibles.",
        content="""## Ce qui se passe

La station de l'**école élémentaire Kaba Sall** continue d'envoyer la température et l'humidité, mais plus aucune mesure de **PM2.5 ni de PM10** depuis le début du mois de novembre. Déjà en juillet, ses valeurs de PM10 restaient bloquées à zéro.

## Conséquences pour vous

- Le quartier Kaba Sall apparaît sur la carte avec la mention **données indisponibles** pour les particules.
- L'indice affiché pour ce quartier est **estimé** à partir des stations voisines (Cité Lamy, Médina Fall).
- Les alertes du quartier restent actives, sur la base de cette estimation.

## Autres capteurs sous surveillance

- **Jules Sagna** et **Médina Fall** : les sondes de température indiquent des valeurs impossibles (en dessous de 0 °C). Les particules ne sont pas concernées.
- **Sud Stade** : une valeur isolée de PM10 très élevée a été écartée.

## Prochaine étape

Une intervention est prévue pour nettoyer ou remplacer le module de particules. Nous publierons un message dès le retour des mesures.""",
        category="info",
        published_at=at("2026-11-03", 11),
        photo="kaba-sall",
        alt="Capteur de qualité de l'air vu de près, avec sa grille d'aération",
        tags=("maintenance", "kaba sall", "capteurs"),
        role="Équipe technique",
    ),
    SeedArticle(
        slug="bruler-dechets-pollue-quartier",
        title="Brûler ses déchets : un geste qui pollue tout le quartier",
        excerpt="Plastiques et ordures brûlés dégagent des fumées toxiques. Des solutions existent pour s'en passer.",
        content="""## Une fumée plus dangereuse qu'elle n'en a l'air

Brûler des déchets dans la rue ou dans la cour dégage des **particules fines** en grande quantité, mais aussi des substances toxiques quand on brûle du plastique, du caoutchouc ou des emballages. La fumée retombe sur les maisons voisines, souvent le soir quand l'air est calme.

## Les risques pour la santé

- Irritation des yeux, de la gorge et des bronches.
- Crises chez les personnes asthmatiques.
- À long terme, risques accrus de maladies respiratoires et cardiaques.

## Que faire à la place ?

- Utilisez la collecte des ordures de votre commune et ses points de regroupement.
- Triez : les déchets de cuisine et les feuilles peuvent faire du compost.
- Les bouteilles et sacs plastiques peuvent être confiés aux filières de récupération.
- Parlez-en avec vos voisins et votre délégué de quartier : un geste collectif change vraiment la qualité de l'air.

## Signaler

Vous constatez des feux de déchets réguliers près d'une école ou d'un centre de santé ? Signalez-le à la mairie de votre commune.""",
        category="education",
        published_at=at("2026-09-23", 9),
        photo="dechets",
        alt="Décharge à ciel ouvert couverte de déchets plastiques",
        tags=("déchets", "fumée", "gestes"),
    ),
    SeedArticle(
        slug="cuisine-charbon-pollution-interieure",
        title="Cuisine au bois et au charbon : attention à l'air de la maison",
        excerpt="L'air intérieur peut être plus pollué que celui de la rue. Quelques gestes simples réduisent l'exposition des familles.",
        content="""## Une pollution invisible

Cuisiner au bois ou au charbon dans une pièce fermée produit beaucoup de **particules fines** et de **monoxyde de carbone (CO)**. Les femmes et les jeunes enfants, qui passent le plus de temps près du foyer, sont les plus exposés.

## Les signes d'alerte

- Fumée qui stagne dans la pièce, yeux qui piquent.
- Maux de tête, vertiges ou nausées : ils peuvent signaler une intoxication au monoxyde de carbone. Sortez immédiatement à l'air libre.

## Gestes simples

- Cuisinez dehors ou sous un abri bien ouvert dès que possible.
- Gardez une porte et une fenêtre ouvertes pendant la cuisson.
- Utilisez du charbon bien sec et un fourneau amélioré, qui consomme moins et fume moins.
- Ne laissez jamais un fourneau allumé dans une chambre fermée, surtout la nuit.
- Tenez les bébés et les jeunes enfants à distance du foyer.

## Et le gaz ?

Le gaz butane pollue beaucoup moins que le bois ou le charbon. Vérifiez régulièrement le tuyau et le détendeur, et aérez la cuisine.""",
        category="education",
        published_at=at("2026-09-09", 9),
        photo="cuisine",
        alt="Marmites sur des fourneaux à charbon dans une cuisine",
        tags=("air intérieur", "cuisine", "monoxyde de carbone"),
        role="Prévention santé",
    ),
    SeedArticle(
        slug="recevoir-alertes-pollution-telephone",
        title="Recevoir les alertes pollution de votre quartier sur votre téléphone",
        excerpt="En trois étapes, l'application SEN-AIR vous prévient quand l'air de votre quartier se dégrade.",
        content="""## Pourquoi activer les alertes ?

Un pic de pollution peut arriver en quelques heures. Avec les alertes, vous êtes prévenu à temps pour adapter vos sorties, fermer les fenêtres ou garder un enfant asthmatique à l'intérieur.

## Comment faire

- **Créez votre compte** dans l'onglet profil de l'application (gratuit).
- **Choisissez vos quartiers** : celui de votre domicile, de votre travail ou de l'école de vos enfants.
- **Réglez le niveau d'alerte** : par exemple à partir de **Mauvais pour les groupes sensibles** si vous êtes concerné, ou **Mauvais** sinon.

Autorisez les notifications quand le téléphone vous le demande.

## Ce que contient une alerte

- Le quartier et la station concernés.
- Le polluant en cause et le niveau atteint.
- Des conseils adaptés à votre profil santé, si vous l'avez renseigné.

## Vos données

Votre profil santé reste facultatif et n'est utilisé que pour adapter les conseils. Vous pouvez le modifier ou le supprimer à tout moment depuis votre compte.""",
        category="info",
        published_at=at("2026-10-02", 9),
        photo="alertes-telephone",
        alt="Jeune enfant qui regarde un téléphone portable",
        tags=("application", "alertes", "mode d'emploi"),
    ),
    SeedArticle(
        slug="atelier-citoyen-mesurer-air-ensemble",
        title="Atelier citoyen le 21 novembre : mesurer l'air ensemble",
        excerpt="Élèves, enseignants et habitants sont invités à découvrir les capteurs SEN-AIR et à lire les données de leur quartier.",
        content="""## Le rendez-vous

Samedi **21 novembre 2026**, de **9 h à 13 h**, à l'**Université Iba Der Thiam de Thiès**. Entrée libre, sur inscription auprès de votre établissement ou de l'équipe SEN-AIR.

## Au programme

- **9 h** : présentation du réseau SEN-AIR et des premiers résultats.
- **9 h 45** : démonstration d'un capteur, démonté et expliqué pièce par pièce.
- **10 h 30** : atelier « Lire la carte et l'indice de son quartier » sur téléphone.
- **11 h 30** : échanges avec des soignants sur la santé respiratoire.
- **12 h 30** : idées des participants pour améliorer l'air à l'école et dans le quartier.

## Pour qui ?

Ouvert à tous, avec une attention particulière pour les élèves et les enseignants des établissements équipés d'un capteur, les associations de quartier et les personnes asthmatiques.

## À apporter

Un téléphone avec l'application SEN-AIR installée, si possible. Des appareils seront prêtés sur place.""",
        category="event",
        published_at=at("2026-11-02", 10),
        photo="atelier",
        alt="Salle de formation à Thiès avec des ordinateurs et une présentation projetée",
        tags=("événement", "atelier", "université"),
    ),
    SeedArticle(
        slug="cadre-legal-qualite-air-senegal",
        title="Qualité de l'air : ce que prévoit la réglementation au Sénégal",
        excerpt="Norme nationale, Code de l'environnement, valeurs guides de l'OMS : les règles qui encadrent l'air que nous respirons.",
        content="""## La norme sénégalaise NS 05-062

La norme **NS 05-062** fixe les valeurs limites de pollution de l'air ambiant au Sénégal. SEN-AIR compare chaque mesure à ces valeurs, qui servent de cadre réglementaire pour déclencher les alertes de niveau **Mauvais**.

## Le Code de l'environnement

Le **Code de l'environnement**, révisé en 2023, encadre les rejets dans l'air des installations classées (usines, carrières, centrales) et interdit les pollutions qui nuisent à la santé. Il prévoit des contrôles et des sanctions en cas d'infraction.

## Les valeurs guides de l'OMS

En 2021, l'Organisation mondiale de la santé a abaissé ses valeurs guides. Pour une moyenne sur 24 heures :

- **PM2.5** : 15 µg/m³
- **PM10** : 45 µg/m³
- **NO₂** : 25 µg/m³
- **SO₂** : 40 µg/m³

Ces valeurs ne sont pas obligatoires, mais elles indiquent le niveau en dessous duquel les risques pour la santé sont faibles. SEN-AIR les utilise pour prévenir les personnes sensibles.

## Pourquoi deux référentiels ?

La norme nationale dit ce qui est **autorisé** ; l'OMS dit ce qui est **sans danger** pour la santé. Afficher les deux permet aux autorités de suivre le respect de la loi, et aux habitants de se protéger plus tôt.""",
        category="regulation",
        published_at=at("2026-09-16", 9),
        photo="code-environnement",
        alt="Route bitumée bordée d'arbres devant une ancienne manufacture de Thiès",
        tags=("réglementation", "normes", "oms"),
    ),
)
