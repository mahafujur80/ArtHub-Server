const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();

dotenv.config();
app.use(express.json());
app.use(cors());




const uri = process.env.MONGODB_URI;
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

    const ArtHubDB = client.db('ArtHub');
    const artWorksCollection = ArtHubDB.collection('artworks');
    const paymentsCollection = ArtHubDB.collection('payments');
    const plansCollection = ArtHubDB.collection('plans');
    const purchasesCollection = ArtHubDB.collection('purchases');
    const userCollection = ArtHubDB.collection('user');


    // artist api
    app.post('/api/artists', async (req, res) => {
      const data = req.body;
      const newArtwork = {
        ...data,
        createAt: new Date(),
      }
      const result = await artWorksCollection.insertOne(newArtwork);
      res.json(result);
    });
    // delete artwork
    app.delete('/api/artwork/:id', async (req, res) => {
      const { id } = req.params;
      const result = await artWorksCollection.deleteOne({ _id: new ObjectId(id) });
      res.json(result);
    });
    app.patch('/api/artwork/:id', async (req, res) => {
      const { id } = req.params;
      const data = req.body;
      const result = await artWorksCollection.updateOne({ _id: new ObjectId(id) }, { $set: data });
      res.json(result);
    });
    // get artworks
    app.get('/api/artwork', async (req, res) => {
      const result = await artWorksCollection.find().toArray();
      res.json(result);
    });
    //get artwork by id
    app.get('/api/artwork/:id', async (req, res) => {
      const { id } = req.params;
      const result = await artWorksCollection.findOne({ _id: new ObjectId(id) });
      res.json(result);
    });
   app.get('/api/purchases', async (req, res) => {
     const userId = req.query.userId
      const result = await purchasesCollection.find({_id: new ObjectId(userId)}).toArray();
      res.json(result);
    });
    // PAYMENTS RELATED API
    app.post('/api/payments', async (req, res) => {
      const data = req.body;
      const { sessionId, type, amount, artistName, artworkName, artworkId, image, artistId, buyerId, buyerName } = data;

      const existingPayment = await paymentsCollection.findOne({ sessionId });
      if (existingPayment) {
        return
      }
      // purchases
      const purchaseObj = {
        image,
        artworkName,
        artworkId,
        buyerId,
      }
      await purchasesCollection.insertOne(purchaseObj);

      // history 
      const newPayment = {
        artistId,
        artistName,
        artworkName,
        buyerId,
        buyerName,
        amount,
        sessionId,
        createAt: new Date(),
      }
      await paymentsCollection.insertOne(newPayment);
    });

  // subscriptions
  app.post('/api/subscriptions', async (req, res) =>{
      const data = req.body;
      const userId = data.buyerId;
      const user = await 
      
      const newSubscription = {
        ...data,
        createAt: new Date(),
      }
      await paymentsCollection.insertOne(newSubscription);
  });

    //PLANS RELATED API
    app.get('/api/plans', async (req, res) => {
      const plan = req.query.plan;
      const result = await plansCollection.findOne({ plan });
      res.json(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




app.get('/', (req, res) => {
  res.send('Hello World');
});
app.listen(process.env.PORT, () => {
  console.log('Server is running on port 5000');
});