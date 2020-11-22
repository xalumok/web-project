var express = require('express');
var bodyParser = require('body-parser')
var mongo = require('mongodb');

var app = express();
var passwordHash = require('password-hash');

var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');

var cart = require('../web-applications-programming-and-support-dev/static/scripts/cart');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser('syla'));

var mc = mongo.MongoClient;
var mongourl = "mongodb://localhost:27017/";
app.set('view engine', 'ejs');
app.use(express.static('static'));



var WebSocket = require("ws");
var prog;

var inProgress = [null, null, null, null];
var ws = [  new WebSocket('ws://127.0.0.1:8080'), 
new WebSocket('ws://127.0.0.1:8081'), 
new WebSocket('ws://127.0.0.1:8082'), 
new WebSocket('ws://127.0.0.1:8083')];
var socketServer = new WebSocket.Server({ port: 8047 });
socketServer.on('connection', function connection(webs) {
    webs.on('message', function incoming(id) {
        console.log(id);
        for (let i = 0; i<4; ++i)
        {
            if (inProgress[i] != null)
            {
                let obj = inProgress[i];
                if (obj.Id == id)
                {
                    webs.send(JSON.stringify({id : id, progress : obj.Progress}));
                    mc.connect(mongourl, {useNewUrlParser:true}, function(err, db) {
                        if (err) 
                        {
                            throw err;
                        }
                        var dbo = db.db("web");
                        dbo.collection("calculations").updateOne({_id: id}, {$set : {Progress: obj.Progress}}, function(err){
                            if (err)
                            {
                                db.close();
                                throw err;
                            }
                            console.log("updated progress");
                            db.close();
                        });
                    });
                    return;
                }
            }
        }
        mc.connect(mongourl, {useNewUrlParser:true}, function(err, db) {
            if (err) 
            {
                throw err;
            }
            var dbo = db.db("web");
            dbo.collection("calculations").findOne({_id: mongo.ObjectID(id)}, function(err, calcs){
                if (err)
                {
                    db.close();
                    throw err;
                }
                if (calcs == null)
                {
                    console.log("failed to find object with id "+ id);
                } else
                {
                    webs.send(JSON.stringify({id : id, progress : calcs.Progress}));
                }
                db.close();                
            });
        });
    });
    for (let i = 0; i<4; ++i)
    {
        ws[i].on('message', function(event)
        {
            var msg = JSON.parse(event);
            if (msg.status == "progress")
            {
                webs.send(JSON.stringify({id : msg.id, progress : msg.progress}));
            }
            if (msg.status == "result")
            {
                webs.send(JSON.stringify({id : msg.id, progress : 100}));
            }
        });
    }
});
for (let i = 0; i<4; ++i)
{
    ws[i].on('message', function(event)
    {
        var msg = JSON.parse(event);
        console.log(msg);
        if (msg.status == "progress")
        {
            inProgress[i].Progress = msg.progress;
        }
        if (msg.status == "result")
        {
            stopCalculation(i, msg.result);
        }
    });
}

function startCalculation(wsId)
{
    if (inProgress[wsId] != null)
    {
        console.log("failed to run on a busy server");
        return;
    }
    inProgress[wsId] = 1;
    mc.connect(mongourl, {useNewUrlParser:true}, function(err, db) {
        if (err) 
        {
            inProgress[wsId] = null;
            throw err;
        }
        var dbo = db.db("web");
        dbo.collection("calculations").findOneAndUpdate({Progress: -1}, {$set: {Progress : 0}}, { sort : {TimeAndDate : 1}}, function(err, calcs){
            if (err)
            {
                inProgress[wsId] = null;
                throw err;
            }
            if (!calcs.value)
            {
                inProgress[wsId] = null;
                console.log("no elements in the queue");
            } else
            {
                inProgress[wsId] = {
                    Id : calcs.value._id,
                    Tvalue : calcs.value.Tvalue,
                    Bvalue : calcs.value.Bvalue,
                    Svalue : calcs.value.Svalue,
                    Fvalue : calcs.value.Fvalue,
                    N : calcs.value.N,
                    Progress : 0,
                    Keyword : calcs.value.Keyword,
                    Result : [0],
                    TimeAndDate : calcs.value.TimeAndDate
                }
                ws[wsId].send(JSON.stringify({object : inProgress[wsId], server : wsId}));
                console.log("calculation started");
                console.log(inProgress[wsId]);
            }
            db.close();
        });
    });
}
function stopCalculation(wsId, res)
{
    let oldId = inProgress[wsId].Id;
    inProgress[wsId] = null;
    mc.connect(mongourl, {useNewUrlParser:true}, function(err, db) {
        if (err) 
        {
            throw err;
        }
        var dbo = db.db("web");
        dbo.collection("calculations").updateOne({_id: oldId}, {$set : {Progress: 100, Result : res}}, function(err){
            if (err)
            {
                db.close();
                throw err;
            }
            console.log("completed calculation");
            startCalculation(wsId);
            db.close();
        });
    });
}
function getKeyword(req)
{
    if (req.signedCookies.keyword === undefined)
    {
        console.log("no keyword set");
        return "";
    } else 
    {
        return JSON.parse(req.signedCookies.keyword).keyword;
    }
}



app.get('/result/:id', function(req, res)
{
    if (req.params.id.length != 24)
    {
        console.log("object with id " + req.params.id + "was not found");
        res.redirect('/history');
        return;
    }
    mc.connect(mongourl, {useNewUrlParser:true}, function(err, db) {
        if (err) throw err;
        var dbo = db.db("web");
        dbo.collection("calculations").findOne({_id : mongo.ObjectId(req.params.id)}, function(err, calcs) {
            if (err) throw err;
            if (!calcs)
            {
                console.log("object with id " + req.params.id + "was not found");
                res.redirect("/history");
                db.close();
            } else
            {
                res.send(calcs.Result);
                db.close();
            }
        });
    });
});

app.get('/create', function(req, res)
{
    res.render("create", {userData :req.signedCookies.userData});
});

app.post('/create', function(req, res)
{
    var object = {
        Tvalue : req.body.Tvalue,
        Bvalue : req.body.Bvalue,
        Svalue : req.body.Svalue,
        Fvalue : req.body.Fvalue,
        N : req.body.N,
        Progress : -1,
        Keyword : getKeyword(req),
        Result : [0],
        TimeAndDate : new Date()
    }
    mc.connect(mongourl, {useNewUrlParser:true}, function(err, db) {
        if (err) 
        {
            throw err;
        }
        var dbo = db.db("web");
        dbo.collection("calculations").insertOne(object, function(err, result) {
            if (err) throw err;
            console.log("calculation added in database");
            res.redirect('/history');
            db.close();
            for (let i = 0; i<4; ++i)
            {
                if (inProgress[i] == null)
                {
                    startCalculation(i);
                    break;
                }
            }
        });
    });
});

app.get('/', function(req, res)
{
    res.render("index", {userData :req.signedCookies.userData});   
});

app.get('/ababa', function(req ,res)
{
    var cur = {start : false, stop : false, progress: true};
    socket.send(JSON.stringify(cur));
    res.redirect("/");
    
});

app.get('/history', function(req, res)
{
    mc.connect(mongourl, {useNewUrlParser:true}, function(err, db) {
        if (err) throw err;
        var dbo = db.db("web");
        dbo.collection("calculations").find({Keyword : getKeyword(req)}).sort({TimeAndDate: -1}).limit(20).toArray(function(err, calcs) {
            if (err) throw err;
            res.render('history', {keyword : getKeyword(req), calcs, userData : req.signedCookies.userData});
            db.close();
        });
    });
});

app.get('/set-keyword', function(req, res)
{
    res.render("set-keyword", {userData :req.signedCookies.userData});
});
app.post('/set-keyword', function(req, res)
{
    res.cookie('keyword', JSON.stringify({keyword : req.body.keyword}), {signed: true});
    res.redirect('/history');    
});
app.get('/stop', function(req, res)
{
    var cur = {start : false, stop : true, progress: false};
    socket.send(JSON.stringify(cur));
    res.redirect("/");
});

app.get('/login', function(req, res) {
    res.render("login", {userData : req.signedCookies.userData});
});

app.get('/register', function(req, res) {
    res.render("register", {userData : req.signedCookies.userData});
});
app.get('/login-success', function(req, res) {
    res.render("login-success", {userData : req.signedCookies.userData, data: req.body});
});


app.post('/login', function(req, res) {
    mc.connect(mongourl, {useNewUrlParser:true}, function(err, db) {
        if (err) 
        {
            throw err;
        }
        var dbo = db.db("web");
        dbo.collection("User").findOne({username: req.body.username}, function(err, user) {
            if (err)
            {
                throw err;
            }
            if (!user)
            {
                res.redirect("login-failed");
            } else if (!passwordHash.verify(req.body.password, user.password))
            {
                res.redirect("login-failed");
            } else
            {
                res.cookie('userData', JSON.stringify({username: user.username, role: user.role}), {signed: true});
                console.log({username: user.username, role: user.role});
                res.redirect('/login-success');
            }
        });
        db.close();
    });
});

app.post('/register', function(req, res) {
    if (req.body.password !== req.body.password2)
    {
        res.render("register", {userData :req.signedCookies.userData});
    } 
    mc.connect(mongourl, {useNewUrlParser:true}, function(err, db) {
        if (err) 
        {
            throw err;
        }
        var dbo = db.db("web");
        dbo.collection("User").findOne({username: req.body.username}, function(err, user) {
            if (err)
            {
                db.close();
                throw err;
            }
            if (!user)
            {
                dbo.collection("User").insertOne({  username : req.body.username, 
                                                    firstname: req.body.firstname, 
                                                    lastname: req.body.lastname,
                                                    role : 'user',
                                                    password : passwordHash.generate(req.body.password)}, function(err, res) {
                                                        if (err) throw err;
                                                        console.log("user registered");
                                                        db.close();
                });
                res.cookie('userData', JSON.stringify({username: req.body.username, role: 'user'}), {signed: true});
                res.redirect('login-success');
            } else {
                res.render("register", {userData :req.signedCookies.userData});
                db.close();
            }
        });
    });
});

app.get('/logout', function(req, res) {
    res.clearCookie('userData');
    res.redirect("/");
});


app.get('/profile', function(req, res)
{
    var cur = JSON.parse(req.signedCookies.userData);
    if (req.signedCookies.userData === undefined)
    {
        console.log("unloged user");
        res.redirect("/");
    } else
    {
        mc.connect(mongourl, {useNewUrlParser:true}, function(err, db) {
            if (err) throw err;
            var dbo = db.db("web");
            dbo.collection("User").findOne({username: cur.username}, function(err, user) {
                if (err) throw err;
                if (!user)
                {
                    res.clearCookie('userData');
                    console.log("user is not found");
                    res.redirect('/');
                } else{
                    res.render("profile", {user : {username: user.username, firstname:user.firstname, lastname:user.lastname}, userData:req.signedCookies.userData});
                }
                db.close();
            });
        });
    }
});

app.get('/change-profile', function(req, res)
{
    var cur = JSON.parse(req.signedCookies.userData);
    if (req.signedCookies.userData === undefined)
    {
        console.log("unlogged user");
        res.redirect("/login");
    } else
    {
        mc.connect(mongourl, {useNewUrlParser:true}, function(err, db) {
            if (err) throw err;
            var dbo = db.db("web");
            dbo.collection("User").findOne({username: cur.username}, function(err, user) {
                if (err) 
                {   
                    throw err;
                }
                if (!user)
                {
                    console.log("edit profile problem: user not found");
                    res.redirect("/");
                } else
                {
                    res.render('change-profile', {userData:req.signedCookies.userData, username: user.username, firstname: user.firstname, lastname:user.lastname});
                }
            });
            db.close();
        });
    }
});

app.post("/change-profile", function(req, res)
{
    var cur = JSON.parse(req.signedCookies.userData);
    if (req.signedCookies.userData === undefined)
    {
        console.log("unlogged user");
        res.redirect("/login");
    } else
    {
        var user = {
            username : req.body.username, 
            firstname : req.body.firstname,
            lastname : req.body.lastname};;
        mc.connect(mongourl, {useNewUrlParser:true}, function(err, db) {
            if (err) 
            {
                throw err;
            }
            var dbo = db.db("web");
            dbo.collection("User").findOne({username: req.body.username}, function(err, userFound) {
                if (err)
                {
                    db.close();
                    throw err;
                }
                if (!userFound || cur.username == req.body.username)
                {
                    dbo.collection("User").updateOne({username: cur.username}, {$set: user}, function(err){
                        if (err)
                        {
                            db.close();
                            throw err;
                        }
                        res.cookie('userData', JSON.stringify({username: req.body.username, role: cur.role}), {signed: true});
                        res.redirect('/profile');
                        db.close();
                    });
                } else {
                    res.clearCookie('userData');
                    console.log('failed to change profile. username already exists');
                    res.redirect('/change-profile');
                    db.close();
                }
            });
        });
    }
});

app.setMaxListeners(4);
app.listen(3000);