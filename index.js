const express = require('express');
const cors = require('cors');
require('dotenv').config()
const port = process.env.PORT || 5000
const app = express()
const { MongoClient, ServerApiVersion } = require('mongodb');
const {  sign } = require('jsonwebtoken');
const jwt = require('jsonwebtoken');
// middlewere

app.use(cors())
app.use(express.json())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.tq1da.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function varifyToken (req,res,next) {
    const authorize = req.headers.authorization
   if(!authorize){
    return res.status(401).send({message:"who are you"})
   }
   const token = authorize.split(" ")[1]
   jwt.verify(token, process.env.ACCESS_TOKEN, function(err, decoded) {
   if(err){
    return res.status(403).send({message:"You can't enter"})
   }
   req.decoded = decoded
   next()
  });
   
}

const run = async () => {
    try{
        await client.connect()
        const serviceCollection = client.db("Doctor's-Portal").collection("Services");
        const bookingCollection = client.db("Doctor's-Portal").collection("bookings");
        const userCollection = client.db("Doctor's-Portal").collection("users");

        app.put('/user/:email',async(req,res)=>{
            const email = req.params.email
            const user = req.body
            const filter = {email:email}
            const options = {upsert:true}
            const updateDoc={
                $set:user
            }
            const result = await userCollection.updateOne(filter,updateDoc,options)
            const token = jwt.sign({email:email},process.env.ACCESS_TOKEN,{expiresIn:'1d'})
            res.send({result,token});
        })
        app.get('/admin/:email',async(req,res)=>{
            const email = req.params.email
            const user = await userCollection.findOne({email:email})
            const isAdmin = user.role === 'admin'
            res.send({admin : isAdmin})
        })

        
        app.put('/user/admin/:email',varifyToken, async(req,res)=>{
            const email = req.params.email
            const requester = req.decoded.email
            const requesterAccount = await userCollection.findOne({email:requester})
            if(requesterAccount.role === 'admin'){
                const filter = {email:email}
                const updateDoc={
                    $set:{role:"admin"}
                }
                const result = await userCollection.updateOne(filter,updateDoc)
                res.send(result);
                
            }
            else{
                return res.status(403).send({message:"you can't enter in the website(*_*)"})

            }
        })
       
        app.get('/users',varifyToken, async(req,res)=>{
            const allUsers = await userCollection.find().toArray()
            res.send(allUsers)
        })

        app.post('/booking',async(req,res)=>{
            const booking = req.body
            console.log(booking.date)
            const query = {treatment:booking.treatment,date:booking.date,patient:booking.patient}
            const exists = await bookingCollection.findOne(query)
            if(exists){
                return res.send({success:false,booking:exists})
            }
            const result = await bookingCollection.insertOne(booking)
            res.send({success:true,result})
        })

        app.get('/booking',varifyToken, async(req,res)=>{
            const patient = req.query.patient
            const authorization = req.headers.authorization
            const decodedEmail = req.decoded.email
            if(patient === decodedEmail){
                const query = {patient:patient}
                const patientBookings = await bookingCollection.find(query).toArray() 
                res.send(patientBookings)
            }
            else{
                return res.status(403).send({message:"you can't enter in the website(*_*)"})
            }
            
        })

        app.get('/avaliable',async (req,res) => {
            const date = req.query.date 
            // step:1 get all the services
            const services = await serviceCollection.find().toArray()
            // step:2 get the booking of that day 
            const query = {date:date}
            const bookings = await bookingCollection.find(query).toArray()

            //step:3 for each service , find bookings for that service

            services.forEach(service => {
                const serviceBookings = bookings.filter(b => b.treatment === service.name)
                const booked = serviceBookings.map(s => s.slot)
                const avaliable = service.slots.filter(s => !booked.includes(s))
                service.avaliable = avaliable
            })
            res.send(services)


        })
        app.get('/service',async (req,res) => {
            const query = {}
            const cursor = serviceCollection.find(query)
            const services = await cursor.toArray()
            res.send(services)
        })



    }
    finally{

    }
}
run().catch(console.dir)

app.get('/',(req,res) => {
    res.send('Success the surver is running')
})

app.listen(port,() => {
    console.log('Connections to the port done'); 
})