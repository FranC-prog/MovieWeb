const express = require('express');
const sqlite3 = require('sqlite3');
const ejs = require('ejs');

const app = express();
const port = process.env.PORT || 3000;

// Serve static files from the "views" directory
app.use(express.static('views'));

// Conectar a la base de datos SQLite
const db = new sqlite3.Database('movies.db');

// Configurar el motor de plantillas EJS
app.set('view engine', 'ejs');

// Ruta para la página de inicio
app.get('/', (req, res) => {
    res.render('index');
});

// Ruta para la búsqueda en general
app.get('/buscar', (req, res) => {
    const searchTerm = req.query.q; //Término de búsqueda, lo que se ingresa en el buscador
    const movieQuery = 'SELECT * FROM movie WHERE title LIKE ?'; //Query para obtener toda la información de una cierta película que coincidan con el término de búsqueda
    const actorQuery = `
    SELECT DISTINCT person.*
    FROM movie_cast
    JOIN person ON person.person_id = movie_cast.person_id
    WHERE person.person_name LIKE ?
    `; //Query para obtener la información de todos los actores que coincidan con el término de búsqueda
    const directorQuery = 'SELECT DISTINCT person.* FROM movie_crew mcr JOIN person ON person.person_id = mcr.person_id WHERE person_name LIKE ? AND mcr.job= \'Director\''; //Query para obtener la información de todos los actores que coincidan con el término de búsqueda
    let moviesData = {}; //Diccionario donde vamos a ir agregando los resultados de la búsqueda, desde el cual vamos a acceder en las correspondientes páginas de .ejs


    // Realizar la búsqueda en la base de datos
    db.all(
        movieQuery,
        [`%${searchTerm}%`],
        (err, movieRows) => {
            if (err) {
                console.error(err);
                res.status(500).send('Error en la búsqueda.');
            } else {
                moviesData.movies = movieRows; //Agregamos las coincidencias de películas al diccionario
                db.all(actorQuery, [`%${searchTerm}%`], //Realizamos una de las queries restantes en el callback
                    (err, actorRows) => {
                        if (err) {
                            console.error(err)
                            res.status(500).send('Error en la búsqueda.')
                        } else {
                            moviesData.actors = actorRows //Agregamos las coincidencias de actores al diccionario
                            db.all(directorQuery, [`%${searchTerm}%`],
                                (err, directorRows)=>{
                                if(err){
                                    console.error(err)
                                    res.status(500).end('Error en la búsqueda')
                                }
                                else{
                                    moviesData.directors = directorRows //Agregamos las coincidencias de directores al diccionario
                                    res.render('resultado', moviesData)} //Renderizamos todos los datos para mostrarlos posteriormente en las páginas correspondientes
                                })
                        }
                    }
                );
            }
        }
    )
}
);

// Ruta para la búsqueda por keyword
app.get('/buscarClaves', (req, res) => {
    const searchTerm = req.query.q;
    const keywordQuery = `
            SELECT DISTINCT m.*
            FROM keyword k
            JOIN movie_keywords mk ON k.keyword_id = mk.keyword_id
            JOIN movie m on mk.movie_id = m.movie_id
            WHERE keyword_name LIKE ?
            ORDER BY m.title ASC
    `; //Query para buscar por keyword
        let moviesData = {}; //Diccionario donde vamos a ir agregando los resultados de la búsqueda, desde el cual vamos a acceder en las correspondientes páginas de .ejs

        // Realizar la búsqueda en la base de datos
        db.all(
            keywordQuery,
            [`%${searchTerm}%`],
            (err, movieRows) => {
                if (err) {
                    console.error(err);
                    res.status(500).send('Error en la búsqueda.');
                } else {
                    moviesData.movies = movieRows; //Agregamos los datos al diccionario en el callback
                    res.render('resultados_keyword', moviesData); //Renderizamos los resultados para mostrarlo
                }
            }
        )
    }
);

// Ruta para la página de datos de una película particular
app.get('/pelicula/:id', (req, res) => {
    const movieId = req.params.id; //Parámetro de búsqueda (movieId en este caso)

    // Consulta SQL para obtener los datos de la película, elenco y crew
    const query = `
    SELECT
      movie.*,
      actor.person_name as actor_name,
      actor.person_id as actor_id,
      crew_member.person_name as crew_member_name,
      crew_member.person_id as crew_member_id,
      movie_cast.character_name,
      movie_cast.cast_order,
      department.department_name,
      movie_crew.job
    FROM movie
    LEFT JOIN movie_cast ON movie.movie_id = movie_cast.movie_id
    LEFT JOIN person as actor ON movie_cast.person_id = actor.person_id
    LEFT JOIN movie_crew ON movie.movie_id = movie_crew.movie_id
    LEFT JOIN department ON movie_crew.department_id = department.department_id
    LEFT JOIN person as crew_member ON crew_member.person_id = movie_crew.person_id
    WHERE movie.movie_id = ?
  `;
    // Consulta SQL para obtener los generos de las peliculas
    const queryGenre = `
    SELECT DISTINCT
        genre_name
        
    FROM movie
    LEFT JOIN movie_genres ON movie.movie_id = movie_genres.movie_id
    LEFT JOIN genre ON movie_genres.genre_id = genre.genre_id
    WHERE movie.movie_id = ?;
   `;
    // Consulta SQL para obtener el pais de produccion
    const queryPCountry = `
    SELECT DISTINCT
        country_name
        
    FROM movie
    LEFT JOIN production_country on movie.movie_id = production_country.movie_id
    LEFT JOIN country ON production_country.country_id = country.country_id
    WHERE movie.movie_id = ?;
   `;
    // Consulta SQL para obtener el nombre de la compañia
    const queryPCompany = `
    SELECT DISTINCT
        company_name
        
    FROM movie
    LEFT JOIN movie_company ON movie.movie_id = movie_company.movie_id
    LEFT JOIN production_company ON movie_company.company_id = production_company.company_id
    WHERE movie.movie_id = ?;
   `;

    // Consulta SQL para obtener los idiomas de la pelicula
    const queryLanguage = `
    SELECT DISTINCT
        language_role,
        language_name,
        language_code
    
    FROM movie
    LEFT JOIN movie_languages ON movie.movie_id = movie_languages.movie_id
    LEFT JOIN language ON movie_languages.language_id = language.language_id
    LEFT JOIN language_role ON movie_languages.language_role_id = language_role.role_id
    WHERE movie.movie_id = ?
    ORDER BY language_role ASC;
   `;
    // Consulta SQL para obtener las keywords de la pelicula
    const queryKeywords = `
    SELECT keyword_name
    FROM movie
    LEFT JOIN movie_keywords ON movie.movie_id = movie_keywords.movie_id
    LEFT JOIN keyword ON movie_keywords.keyword_id = keyword.keyword_id
    WHERE movie.movie_id = ?;
   `;
    // Ejecutar la consulta
    db.all(query, [movieId], (err, rows) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error al cargar los datos de la película.');
        } else if (rows.length === 0) {
            res.status(404).send('Película no encontrada.');
        } else {
            // Organizar los datos en un objeto de película con elenco y crew
            var movieData = {
                id: rows[0].id,
                title: rows[0].title,
                release_date: rows[0].release_date,
                overview: rows[0].overview,
                directors: [],
                writers: [],
                cast: [],
                crew: [],
                genres: [],
                keywords: [],
                production_country: [],
                company_name: rows[0].company_name,
                language_name: rows[0].language_name,
                budget: rows[0].budget,
                revenue: rows[0].revenue,
                runtime: rows[0].runtime,
                movie_status: rows[0].movie_status,
                vote_average: rows[0].vote_average,
                vote_count: rows[0].vote_count,
                popularity: rows[0].popularity,
                homepage: rows[0].homepage,
                tagline: rows[0].tagline,
            };

            // Crear un objeto para almacenar directores
            rows.forEach((row) => {
                if (row.crew_member_id && row.crew_member_name && row.department_name && row.job) {
                    // Verificar si ya existe una entrada con los mismos valores en directors
                    const isDuplicate = movieData.directors.some((crew_member) =>
                        crew_member.crew_member_id === row.crew_member_id
                    );

                    if (!isDuplicate) {
                        // Si no existe, agregar los datos a la lista de directors
                        if (row.department_name === 'Directing' && row.job === 'Director') {
                            movieData.directors.push({
                                crew_member_id: row.crew_member_id,
                                crew_member_name: row.crew_member_name,
                                department_name: row.department_name,
                                job: row.job,
                            });
                        }
                    }
                }
            });


            // Crear un objeto para almacenar writers
            rows.forEach((row) => {
                if (row.crew_member_id && row.crew_member_name && row.department_name && row.job) {
                    // Verificar si ya existe una entrada con los mismos valores en writers
                    const isDuplicate = movieData.writers.some((crew_member) =>
                        crew_member.crew_member_id === row.crew_member_id
                    );

                    if (!isDuplicate) {
                        // Si no existe, agregar los datos a la lista de writers
                        if (row.department_name === 'Writing' && row.job === 'Writer') {
                            movieData.writers.push({
                                crew_member_id: row.crew_member_id,
                                crew_member_name: row.crew_member_name,
                                department_name: row.department_name,
                                job: row.job,
                            });
                        }
                    }
                }
            });

            // Crear un objeto para almacenar el elenco
            rows.forEach((row) => {
                if (row.actor_id && row.actor_name && row.character_name) {
                    // Verificar si ya existe una entrada con los mismos valores en el elenco
                    const isDuplicate = movieData.cast.some((actor) =>
                        actor.actor_id === row.actor_id
                    );

                    if (!isDuplicate) {
                        // Si no existe, agregar los datos a la lista de elenco
                        movieData.cast.push({
                            actor_id: row.actor_id,
                            actor_name: row.actor_name,
                            character_name: row.character_name,
                            cast_order: row.cast_order,
                        });
                    }
                }
            });

            // Crear un objeto para almacenar el crew
            rows.forEach((row) => {
                if (row.crew_member_id && row.crew_member_name && row.department_name && row.job) {
                    // Verificar si ya existe una entrada con los mismos valores en el crew
                    const isDuplicate = movieData.crew.some((crew_member) =>
                        crew_member.crew_member_id === row.crew_member_id
                    );

                    // console.log('movieData.crew: ', movieData.crew)
                    // console.log(isDuplicate, ' - row.crew_member_id: ', row.crew_member_id)
                    if (!isDuplicate) {
                        // Si no existe, agregar los datos a la lista de crew
                        if (row.department_name !== 'Directing' && row.job !== 'Director'
                            && row.department_name !== 'Writing' && row.job !== 'Writer') {
                            movieData.crew.push({
                                crew_member_id: row.crew_member_id,
                                crew_member_name: row.crew_member_name,
                                department_name: row.department_name,
                                job: row.job,
                            });
                        }
                    }
                }
            });

            //Anida los datos extras de las películas, los guarda en sus objetos correspondientes y luego renderiza la página al final
            db.all(queryGenre, [movieId], (err, rows2) => {

                movieData.genres = rows2

                db.all(queryPCountry, [movieId], (err, rows3) => {

                    movieData.production_country = rows3

                    db.all(queryPCompany, [movieId], (err, rows4) => {

                        movieData.company_name = rows4

                        db.all(queryLanguage, [movieId], (err, rows5) => {

                            movieData.language_name = rows5

                            db.all(queryKeywords, [movieId], (err, rows6) => {

                                movieData.keywords = rows6

                                res.render('pelicula', { movie: movieData });
                            })

                        })
                    })

                })
            })

        }
    });

});

// Ruta para mostrar la página de un actor específico
app.get('/actor/:id', (req, res) => {
    const actorId = req.params.id;
    let moviesData = {}; //Diccionario donde vamos a ir agregando los resultados de la búsqueda, desde el cual vamos a acceder en las correspondientes páginas de .ejs

    // Consulta SQL para obtener las películas en las que participó el actor
    const actedQuery = `
    SELECT DISTINCT
      person.person_name as actorName,
      movie.*
    FROM movie
    INNER JOIN movie_cast ON movie.movie_id = movie_cast.movie_id
    INNER JOIN person ON person.person_id = movie_cast.person_id
    WHERE movie_cast.person_id = ?;
  `; //Query para mostrar las películas en las cuales actuó una cierta persona

    const directedQuery = `
    SELECT DISTINCT movie.*
    FROM movie_crew mc
    JOIN person ON mc.person_id = person.person_id
    JOIN movie ON mc.movie_id = movie.movie_id
    WHERE mc.job = \'Director\' AND mc.person_id = ?;
  `; //Query para mostrar las películas que dirigió una cierta persona

    // Ejecutar la consulta
    db.all(actedQuery, [actorId], (err, actedMovies) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error al cargar las películas del actor.');
        } else {
            // Obtener el nombre del actor
            const actorName = actedMovies.length > 0 ? actedMovies[0].actorName : '';
            moviesData.acted = actedMovies //Agregamos las películas en las que actuó al diccionario
            db.all(directedQuery, [actorId], (err, directedMovies) => { //Realizamos la otra query en el callback
                if(err) {
                    console.error(err);
                    res.status(500).send('Error al cargar las películas del actor')
                } else {
                    moviesData.directed = directedMovies //Agregamos las películas que dirigió al diccionario
                    res.render('actor', { actorName, moviesData } ) //Renderizamos los resultados para mostrarlos
                }
            })
        }
    });
});

// Ruta para mostrar la página de un director específico
app.get('/director/:id', (req, res) => {
    const directorId = req.params.id;

    // Consulta SQL para obtener las películas dirigidas por el director
    const directedQuery = `
    SELECT DISTINCT
      person.person_name as directorName,
      movie.*
    FROM movie
    INNER JOIN movie_crew ON movie.movie_id = movie_crew.movie_id
    INNER JOIN person ON person.person_id = movie_crew.person_id
    WHERE movie_crew.job = 'Director' AND movie_crew.person_id = ?;
  `; //Query para mostrar las películas que dirigió una cierta persona
    let directorData = {}; //Diccionario donde vamos a ir agregando los resultados de la búsqueda, desde el cual vamos a acceder en las correspondientes páginas de .ejs
    const actedQuery = `
    SELECT DISTINCT
      person.person_name as actorName,
      movie.*
    FROM movie
    INNER JOIN movie_cast ON movie.movie_id = movie_cast.movie_id
    INNER JOIN person ON person.person_id = movie_cast.person_id
    WHERE movie_cast.person_id = ?; //Query para mostrar las películas en las que actuó una cierta persona
  `;

    // Ejecutar la consulta
    db.all(directedQuery, [directorId], (err, directedMovies) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error al cargar las películas del director.');
        } else {
            // Obtener el nombre del director
            const directorName = directedMovies.length > 0 ? directedMovies[0].directorName : '';
            directorData.directed = directedMovies; //Agregamos las películas que dirigió al diccionario
            directorData.directorName = directorName; //Agregamos el nombre del director al diccionario
            db.all(actedQuery, [directorId], (err,actedMovies) => { //Realizamos la otra query en el callback
                if(err){
                    console.error(err);
                    res.status(500).send('Error al cargar las películas del director.');
                }
                else{
                    directorData.acted = actedMovies; //Agregamos las películas en las que actuó al diccionario
                    res.render('director', {directorName, directorData});//Renderizamos los resultados para mostrarlos
                }
            })
        }
    });
});

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor en ejecución en http://localhost:${port}`);
});
