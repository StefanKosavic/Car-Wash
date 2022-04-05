var express = require('express');
var router = express.Router();
const bcrypt = require('bcrypt');
const {userAuthorization}=require("./authorization");
var pg =require('pg');

/* I used the postgres database and made a free instance via https://www.elephantsql.com/ which I linked here */
var config = {
    user: 'dewjmeqq',
    database: 'dewjmeqq',
    password: 'tLgUVg8q-t19GkzXsF93ebZARAvBvNiE',
    host: 'manny.db.elephantsql.com',
    port: 5432,
    max: 100,
    idleTimeoutMillis: 30000,
};
var pool = new pg.Pool(config);


router.get('/login', function(req, res, next) {
    res.render('carwash/login');
});

router.get('/register', function(req, res, next) {
    res.render('carwash/register');
});

/* The log out route simply destroys the current session and in that way the user without the session must log in again to gain access */
router.get('/logout', function(req, res, next) {
    req.session.destroy();
    res.render('carwash/login');
});


/* When registering a new user, I take the password that the user entered when filling out the form.
   Using bcrypt, I convert this password into a hashed string and, together with other data from the form, save it to the database as a new user.
   When making this application, I decided not to focus so much on login / register validation, because I think it is not so necessary for this task,
   but I left the options open, that is, for example, the ability to put a password of only 4 letters, etc. */
router.post('/register', async function(req, res, next) {

    const hashedPassword = await bcrypt.hash(req.body.password,10);

    var  carwashUser =  {
        firstname: req.body.firstname,
        lastname: req.body.lastname,
        username: req.body.username,
        password: hashedPassword
    };
    pool.connect(function(err,client,done){
        if(!carwashUser.firstname || !carwashUser.lastname || !carwashUser.username){
            res.sendStatus(500).send("Can t be empty");
        } else{
            client.query(`insert into carwashUser (firstname,lastname,username,password)
                          values ($1,$2,$3,$4)`,
                [carwashUser.firstname,carwashUser.lastname,carwashUser.username, carwashUser.password],
                function (err,result){
                    done();
                    if(err){
                        res.render("carwash/register")
                        console.log(err)
                    }else{
                        res.render("carwash/login")
                    }
                })
        }
    })
});

/* When logging in to the system, I take information about the user's username and password from the form.
   I then send a request to the database to pick up data on that user, if one exists. If the combination of username and password is correct,
   the user gets access to the system, and I save his data in a session so I can access them later when I need them.
   Package I used: https://www.npmjs.com/package/express-session */
router.post('/login', async function(req, res, next) {
    var carwashUser = {
        username: req.body.username,
        password: req.body.password,
    };
    pool.connect(function(err,client,done){
        if(err){
            res.end('{"error" : "Error", "status" : 500');
        }
        client.query(`SELECT * FROM carwashuser where username=$1`,[carwashUser.username],async function (err,result){
            done();
            if(err){
                console.info(err);
                res.sendStatus(500);
            }else{
                if(result.rows.length === 0){
                    return res.sendStatus(404);
                }else{
                    let kriptoPassword = result.rows[0].password;
                    if(await bcrypt.compare(carwashUser.password,kriptoPassword)){
                        res.carwashUser = {
                            id: result.rows[0].id_user,
                            firstname: result.rows[0].firstname,
                            lastname: result.rows[0].lastname,
                            username: result.rows[0].username,
                            runs: result.rows[0].runs
                        }
                        req.session.id_user = res.carwashUser.id;
                        req.session.user_username = res.carwashUser.username;
                        req.session.runs = res.carwashUser.runs;
                        res.redirect('/carwash/home');
                    }
                    else{
                        return res.sendStatus(401);
                    }
                }
            }
        })
    })
});
/*  Home collects all available car wash programs and displays them to the user.
    Here the user can directly use only one car wash program or if he wants an advanced car wash,
    he can combine several programs that suit him and thus wash the car*/
router.get('/home', userAuthorization, function(req, res, next) {
    let runs = req.session.runs;
    let username =req.session.user_username;
    pool.connect(function(err,client,done){
        if(err){
            res.end('{"error" : "Error", "status" : 500');
        }
        client.query(`SELECT * FROM washing_program order by id_washing_program`,[],function (err,result){
            done();
            if(err){
                console.info(err);
                res.sendStatus(500);
            }else{
                req.programs = result.rows;
                res.render('carwash/home', {
                    programs:req.programs,runs,username
                });
            }
        })
    })
});
/*  Here the user confirms the car wash and all data about the user and
    the car wash are saved as activities of that user which we can check later*/
router.post('/wash/:name/:price', async function(req, res, next) {
    let idUser =  req.session.id_user ;
    pool.connect(function(err,client,done){
        client.query(`insert into activities (activities,price,id_user)
                          values ($1,$2,$3)`,
            [req.params.name,req.params.price,idUser],
            function (err,result){
                done();
                if(err){
                    res.sendStatus(401)
                }else{
                    res.sendStatus(200)
                }
            })
    })
});
/*  Here we store all the programs that the user has selected for advanced car washing*/
router.post('/add_to_washing_program/:id', async function(req, res, next) {
    let id_user = req.session.id_user ;
    pool.connect(function(err,client,done){
        client.query(`insert into combined_wash (id_washing_program,id_user)
                          values ($1,$2)`,
            [req.params.id,id_user],
            function (err,result){
                done();
                if(err){
                    res.sendStatus(401)
                }else{
                    res.sendStatus(200)
                }
            })
    })
});
/*  We get an overview of advanced car wash data created by the user*/
router.get('/washing_programs', userAuthorization, function(req, res, next) {
    let runs = req.session.runs;
    let username =req.session.user_username;
    pool.connect(function(err,client,done){
        if(err){
            res.end('{"error" : "Error", "status" : 500');
        }
        client.query(`select * from carwashuser cu,combined_wash cw,washing_program wp where
                      cu.id_user = cw.id_user and cw.id_washing_program = wp.id_washing_program`,
            [],function (err,result){
            done();
            if(err){
                console.info(err);
                res.sendStatus(500);
            }else{

                req.washing_programs = result.rows;
                res.render('carwash/washingPrograms', {
                    washing_programs:req.washing_programs,runs,username
                });
            }
        })
    })
});
/*  In this route we confirm the user confirms the car wash.
    After confirmation, several things happen: A new activity is created that stores all the washing data,
    the table in which the advanced washing data was stored is cleaned,
    and the number of washes for that user is increased by 1.
    This number of washes is important for us to calculated the level of customer loyalty
    and thus knew how much discount on car wash that user received.*/
router.post('/finishWashing/:programs/:price', async function(req, res, next) {
    let idUser = req.session.id_user ;
    pool.connect(function(err,client,done){
        client.query(`insert into activities (activities,price,id_user)
                          values ($1,$2,$3)`,
            [req.params.programs,req.params.price,idUser],
            function (err,result){
                done();
                if(err){
                    res.sendStatus(401)
                }else{
                    pool.connect(function(err,client,done){
                        client.query(`delete from combined_wash`,
                            [],
                            function (err,result){
                                done();
                                if(err){
                                    res.sendStatus(401)
                                }else{
                                    pool.connect(function(err,client,done){
                                        client.query(`update carwashuser set runs=runs+1 where id_user=$1`,
                                            [idUser],
                                            function (err,result){
                                                done();
                                                if(err){
                                                    res.sendStatus(401)
                                                }else{
                                                    res.sendStatus(200)
                                                }
                                            })
                                    })
                                }
                            })
                    })
                }
            })
    })
});
/*  We get an overview of all the activities and car washes performed by the users of this site*/
router.get('/activities', userAuthorization,function(req, res, next) {
    let runs = req.session.runs;
    let username =req.session.user_username;
    console.log(runs)
    pool.connect(function(err,client,done){
        if(err){
            res.end('{"error" : "Error", "status" : 500');
        }
        client.query(`select TO_CHAR(date, 'DD/MM/YYYY') as date,username,activities,price
         from activities a, carwashuser c where a.id_user=c.id_user`,
            [],function (err,result){
                done();
                if(err){
                    console.info(err);
                    res.sendStatus(500);
                }else{
                    req.activities = result.rows;
                    res.render('carwash/activities', {
                        activities:req.activities,runs,username
                    });
                }
            })
    })
});
/*  We empty all the programs that the user combined for car washing*/
router.delete('/washing_programs', function(req, res, next) {
    pool.connect(function(err,client,done){
        if(err){
            res.end('{"error" : "Error", "status" : 500');
        }
        client.query(`delete from combined_wash`,
            [],function (err,result){
                done();
                if(err){
                    console.info(err);
                    res.sendStatus(500);
                }else{
                    res.sendStatus(200)
                }
            })
    })
});
module.exports = router;
