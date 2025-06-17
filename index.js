const express = require('express');
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());


// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@data-house.3s1f0x8.mongodb.net/?retryWrites=true&w=majority&appName=Data-house`;
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@data-house.3s1f0x8.mongodb.net/?retryWrites=true&w=majority&appName=Data-house`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    
    const hotelsCollection = client.db('hotesBookings').collection('hotels');
    const guestsCollection = client.db('hotesBookings').collection('visitors');

    // all hotels getting api
    app.get('/hotels',async(req,res)=>{
      const cursor = hotelsCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    })

    // my bookings data getting api
    app.get('/visitors',async(req,res)=>{
      const email = req.query.email
      const query = {
        guest:email
      }
      const result = await guestsCollection.find(query).toArray();
      res.send(result);
    })
    // user data added api
    app.post('/visitors',async(req,res)=>{
      const guestInfo = req.body;
      console.log(guestInfo)
      const result = await guestsCollection.insertOne(guestInfo);
      res.send(result);
    })
    
    // get data using id
    app.get('/hotels/:id',async(req,res)=>{
      const id = req.params.id;
      const query = {_id:new ObjectId(id)}
      const result = await hotelsCollection.findOne(query);
      res.send(result);
    })
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    
  }
}
run().catch(console.dir);

app.get('/',(req,res)=>{
    res.send('running hotet booking server site')
})
app.listen(port,()=>{
    console.log(`hotet booking server is running on port: ${port}`)
})


