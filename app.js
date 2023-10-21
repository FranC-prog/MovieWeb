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

// Ruta para la búsqueda en general (falta agregar el botón de switch para buscar por keyword)
app.get('/buscar', (req, res) => {
    const searchTerm = req.query.q;
    const movieQuery = 'SELECT * FROM movie WHERE title LIKE ?';
    const actorQuery = `
    SELECT DISTINCT person.*
    FROM movie_cast
    JOIN person ON person.person_id = movie_cast.person_id
    WHERE person.person_name LIKE ?
    `;
    const directorQuery = 'SELECT DISTINCT person.* FROM movie_crew mcr JOIN person ON person.person_id = mcr.person_id WHERE person_name LIKE ? AND mcr.job= \'Director\'';
    let moviesData = {};


    // Realizar la búsqueda en la base de datos
    db.all(
        movieQuery,
        [`%${searchTerm}%`],
        (err, movieRows) => {
            if (err) {
                console.error(err);
                res.status(500).send('Error en la búsqueda.');
            } else {
                moviesData.movies = movieRows;
                db.all(actorQuery, [`%${searchTerm}%`],
                    (err, actorRows) => {
                        if (err) {
                            console.error(err)
                            res.status(500).send('Error en la búsqueda.')
                        } else {
                            moviesData.actors = actorRows
                            db.all(directorQuery, [`%${searchTerm}%`],
                                (err, directorRows)=>{
                                if(err){
                                    console.error(err)
                                    res.status(500).end('Error en la búsqueda')
                                }
                                else{
                                    moviesData.directors = directorRows
                                    res.render('resultado', moviesData)}
                                })
                        }
                    }
                );
            }
        }
    )
}
);



// Ruta para la página de datos de una película particular
app.get('/pelicula/:id', (req, res) => {
    const movieId = req.params.id;

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

    // Ejecutar la consulta
    db.all(query, [movieId], (err, rows) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error al cargar los datos de la película.');
        } else if (rows.length === 0) {
            res.status(404).send('Película no encontrada.');
        } else {
            // Organizar los datos en un objeto de película con elenco y crew
            const movieData = {
                id: rows[0].id,
                title: rows[0].title,
                release_date: rows[0].release_date,
                overview: rows[0].overview,
                directors: [],
                writers: [],
                cast: [],
                crew: [],
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

            res.render('pelicula', { movie: movieData });
        }
    });
});

// Ruta para mostrar la página de un actor específico
app.get('/actor/:id', (req, res) => {
    const actorId = req.params.id;
    let moviesData = {};

    // Consulta SQL para obtener las películas en las que participó el actor
    const actedQuery = `
    SELECT DISTINCT
      person.person_name as actorName,
      movie.*
    FROM movie
    INNER JOIN movie_cast ON movie.movie_id = movie_cast.movie_id
    INNER JOIN person ON person.person_id = movie_cast.person_id
    WHERE movie_cast.person_id = ?;
  `;

    const directedQuery = `
    SELECT DISTINCT movie.*
    FROM movie_crew mc
    JOIN person ON mc.person_id = person.person_id
    JOIN movie ON mc.movie_id = movie.movie_id
    WHERE mc.job = \'Director\' AND mc.person_id = ?;
  `;

    // Ejecutar la consulta
    db.all(actedQuery, [actorId], (err, actedMovies) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error al cargar las películas del actor.');
        } else {
            // Obtener el nombre del actor
            const actorName = actedMovies.length > 0 ? actedMovies[0].actorName : '';
            moviesData.acted = actedMovies
            db.all(directedQuery, [actorId], (err, directedMovies) => {
                if(err) {
                    console.error(err);
                    res.status(500).send('Error al cargar las películas del actor')
                } else {
                    moviesData.directed = directedMovies
                    res.render('actor', { actorName, moviesData } )
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
  `;
    let directorData = {};
    const actedQuery = `
    SELECT DISTINCT
      person.person_name as actorName,
      movie.*
    FROM movie
    INNER JOIN movie_cast ON movie.movie_id = movie_cast.movie_id
    INNER JOIN person ON person.person_id = movie_cast.person_id
    WHERE movie_cast.person_id = ?;
  `;

    // Ejecutar la consulta
    db.all(directedQuery, [directorId], (err, directedMovies) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error al cargar las películas del director.');
        } else {
            // Obtener el nombre del director
            const directorName = directedMovies.length > 0 ? directedMovies[0].directorName : '';
            directorData.directed = directedMovies;
            directorData.directorName = directorName;
            db.all(actedQuery, [directorId], (err,actedMovies) => {
                if(err){
                    console.error(err);
                    res.status(500).send('Error al cargar las películas del director.');
                }
                else{
                    directorData.acted = actedMovies;
                    res.render('director', {directorName, directorData});
                }
            })
        }
    });
});


// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor en ejecución en http://localhost:${port}`);
});
