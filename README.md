# Zonnepanelen Monitor (Torhout)

Eenvoudige statische website om dagelijks meterstanden in te geven en je zonnepanelenverbruik op te volgen.

## Functies

- Dagelijkse ingave: afname, injectie, productie, batterij laden/ontladen
- Historische invoer via CSV-lijnen (bulk import)
- Grafieken op basis van je data (geen externe libraries nodig)
- Maanden met meeste zon aanduiden (met voorstel voor Torhout)
- Lokale opslag in de browser (`localStorage`)

## Lokaal testen

```bash
python3 -m http.server 8080
```

Open daarna [http://localhost:8080](http://localhost:8080).

## Dataformaat voor historische invoer

Per lijn:

```txt
YYYY-MM-DD,afname,injectie,productie,batterij_geladen,batterij_ontladen
```

Voorbeeld:

```txt
2026-03-01,8.4,2.1,11.7,3.0,2.6
2026-03-02,7.2,1.7,10.3,2.4,2.1
```

## Pushen naar GitHub + publiceren

1. Maak een nieuwe GitHub repo.
2. Koppel je lokale map aan die repo:

```bash
git remote add origin https://github.com/<jouw-username>/<repo-naam>.git
```

3. Commit en push:

```bash
git add index.html styles.css app.js README.md
git commit -m "Nieuwe zonnepanelen monitor website"
git branch -M main
git push -u origin main
```

4. Activeer GitHub Pages in je repo:
   - `Settings` > `Pages`
   - `Source`: `Deploy from a branch`
   - `Branch`: `main` + `/root`

Daarna staat je site live op:

`https://<jouw-username>.github.io/<repo-naam>/`
