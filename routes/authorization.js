/* I use this js file to check in it via the "userAuthorization" function if the user has a session,
   ie. whether he has access to some routes. The function is forwarded to the route before any operations are performed.
   If there is no session, the function requires the user to log in, and if there is a session, the user can access all parts of the system. */
function userAuthorization(req,res,next){
    if(req.session.user_username==null){
        res.render('carwash/login')
    }
    else{
        next();
    }
}

module.exports = {
    userAuthorization
}