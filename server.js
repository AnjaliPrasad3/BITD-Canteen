require('dotenv').config()
const express = require('express')
const app = express() //all the functionality of express will be stored in app variable. 
const ejs = require('ejs')
const path = require('path')
const expressLayout = require('express-ejs-layouts')

const PORT = process.env.PORT || 3300
const mongoose = require('mongoose')
const session = require('express-session')
const flash = require('express-flash')
const MongoDbStore = require('connect-mongo')(session)
const passport = require('passport')
const Emitter = require('events')



//Database Connection
mongoose.connect(process.env.MONGO_CONNECTION_URL, {
    //usedNewUrlParser: true, 
    //useCreateIndex:true, 
    //useUnifiedTopology: true, 
    //useFindAndModify : false 
}).then(() => {
    console.log('Database connected...');
}).catch(err => {
    console.log('Connection failed...', err)
});
const connection = mongoose.connection;



//Sesstion store
let mongoStore = new MongoDbStore({
    mongooseConnection: connection,
    collection: 'sessions'
})

//Event emitter
const eventEmitter = new Emitter()
app.set('eventEmitter', eventEmitter)

//Session config
app.use(session({
    secret: process.env.COOKIE_SECRET,
    resave: false,
    store: mongoStore,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }  //milli sec - 24 hours
    // cookie: { maxAge: 1000 * 24 }  // 15 sec
}))

//Passport config
const passportInit = require('./app/config/passport')
//const { Server } = require('http')
passportInit(passport)
app.use(passport.initialize())
app.use(passport.session())

app.use(flash())
//Assets
app.use(express.static('public'))
app.use(express.urlencoded({ extended: false }))
app.use(express.json())


//Global middleware  --to use session in layout.ejs
app.use((req, res, next) => {
    res.locals.session = req.session
    res.locals.user = req.user
    next()
})
//set Template engine
app.use(expressLayout)
app.set('views', path.join(__dirname, '/resources/views'))
app.set('view engine', 'ejs')

//Routes
require('./routes/web')(app)
app.use((req, res) => {
    res.status(404).render('errors/404')
})


const server = app.listen(PORT , () => {
    console.log(`Listening on port ${PORT}`)
})


//Socket
const io = require('socket.io')(server)
io.on('connection', (socket) => {
      // Join
      socket.on('join', (orderId) => {
        socket.join(orderId)
      })
})

eventEmitter.on('orderUpdated', (data) => {
    io.to(`order_${data.id}`).emit('orderUpdated', data)
})

eventEmitter.on('orderPlaced', (data) => {
    io.to('adminRoom').emit('orderPlaced', data)
})