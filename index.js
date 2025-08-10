const express = require('express');
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const stripe = require('stripe')(process.env.PAYMENT_GATEWAY_KEY);
const app = express();
const port = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@data-house.3s1f0x8.mongodb.net/?retryWrites=true&w=majority&appName=Data-house`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


const hotelsCollection = client.db('hotesBookings').collection('hotels');
const guestsCollection = client.db('hotesBookings').collection('visitors');
const reviewsCollection = client.db('hotesBookings').collection('reviewers');
const paymentsCollection = client.db('hotesBookings').collection('payments');

// get hotel data using id
app.get('/hotels/:id', async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) }
  const result = await hotelsCollection.findOne(query);
  res.send(result);
})
// filter hotels
// app.get('/hotels', async (req, res) => {
//   const min = parseInt(req.query.min) || 0;
//   const max = parseInt(req.query.max) || Infinity;

//   const query = {
//     price: { $gte: min, $lte: max }
//   };
//   console.log("Final Query to DB:", query);
//   const result = await hotelsCollection.find(query).toArray();
//   res.send(result);
// });

app.get('/hotels', async (req, res) => {
    // মূল্য অনুসারে ফিল্টার করার জন্য কোড অপরিবর্তিত
    const min = parseInt(req.query.min) || 0;
    const max = parseInt(req.query.max) || Infinity;

    const query = {
        price: { $gte: min, $lte: max }
    };
    
    try {
        // প্রথমে সমস্ত হোটেল ডেটা আনা হচ্ছে
        const hotels = await hotelsCollection.find(query).toArray();

        // প্রতিটি হোটেলের জন্য রেটিং ক্যালকুলেট করার লজিক
        const hotelsWithRatings = await Promise.all(
            hotels.map(async (hotel) => {
                // এই হোটেলের _id ব্যবহার করে রিভিউ ডেটা খুঁজে বের করা হচ্ছে
                const reviews = await reviewsCollection.find({ bookingId: hotel._id.toString() }).toArray();

                let averageRating = 0;
                if (reviews.length > 0) {
                    // সমস্ত রেটিং যোগ করে গড় বের করা
                    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
                    averageRating = (totalRating / reviews.length).toFixed(1); // দশমিকের পর এক ঘর পর্যন্ত রাখা
                }

                // মূল হোটেল অবজেক্টে নতুন 'rating' প্রপার্টি যোগ করা
                return { ...hotel, rating: parseFloat(averageRating) };
            })
        );
        
        res.send(hotelsWithRatings);

    } catch (error) {
        console.error("Error fetching hotels with ratings:", error);
        res.status(500).send({ message: "Server error" });
    }
});





// getting visitors data using id
app.get('/visitors/:id', async (req, res) => {
  const id = req.params.id;
  console.log(id)
  const query = { _id: new ObjectId(id) }
  const result = await guestsCollection.findOne(query);
  res.send(result);
})
// my bookings data getting api
app.get('/visitors', async (req, res) => {
  const email = req.query.email
  const query = {
    guest: email
  }
  const result = await guestsCollection.find(query).toArray();
  res.send(result);
})

// guest data added api
app.post('/visitors', async (req, res) => {
  const { roomId, checkInDate, guest, name, photo, guestNumber, phone, type, checkOutDate, price } = req.body;
  console.log(checkInDate)
  try {
    const newCheckIn = new Date(checkInDate + 'T00:00:00Z');
    const newCheckOut = new Date(checkOutDate + 'T00:00:00Z');
    const overlappingBooking = await guestsCollection.findOne({
      roomId: roomId,
      $or: [
        {
          checkInDate: { $lt: newCheckOut },
          checkOutDate: { $gt: newCheckIn }
        }
      ]
    });

    if (overlappingBooking) {
      return res.status(409).send({ message: 'Room is not available for the selected dates.' });
    }

    const newBooking = {
      guest,
      name,
      phone,
      type,
      guestNumber,
      photo,
      roomId,
      price,
      checkInDate: newCheckIn,
      checkOutDate: newCheckOut,
      createdAt: new Date()
    };

    const result = await guestsCollection.insertOne(newBooking);
    res.send(result);

  } catch (error) {
    console.error('Booking failed:', error);
    res.status(500).send({ message: 'Booking failed', error: error.message });
  }
})


// get reviews by specific room id

app.get('/reviews', async (req, res) => {
  const bookingId = req.query.bookingId;
  console.log(bookingId)
  try {
    const reviews = await reviewsCollection.find({ bookingId }).toArray();
    res.send(reviews);
  } catch (error) {
    res.status(500).send({ message: 'Failed to fetch reviews', error });
  }
});


// reviews post
app.post('/reviewers', async (req, res) => {
  const reviewInfo = req.body;
  const result = await reviewsCollection.insertOne(reviewInfo);
  res.send(result);
})
// GET latest reviews sorted by date
app.get('/rooms-reviews', async (req, res) => {
  const result = await reviewsCollection
    .find()
    .sort({ date: -1 })
    .limit(6)
    .toArray();
  res.send(result);

});

// get  top rated rooms based on ratings
app.get('/toprated', async (req, res) => {
  try {
    const hotels = await hotelsCollection.find().toArray();

    const hotelWithRatings = await Promise.all(
      hotels.map(async (hotel) => {
        const reviews = await reviewsCollection
          .find({ bookingId: hotel._id.toString() })
          .toArray();

        let averageRating = 0;
        if (reviews.length > 0) {
          const total = reviews.reduce((sum, r) => sum + (r.rating || 0), 0);
          averageRating = total / reviews.length;
        }

        return {
          ...hotel,
          rating: parseFloat(averageRating.toFixed(1)) // Keep one decimal point
        };
      })
    );

    // Sort by rating descending and get top 6
    const sortedTopHotels = hotelWithRatings
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 8);

    // Select only the required fields
    const topRatedRooms = sortedTopHotels.map(hotel => ({
      _id: hotel._id,
      type: hotel.type,
      price: hotel.price,
      roomImage: hotel.roomImage,
      description: hotel.description,
      maxGuests: hotel.maxGuests,
      rating: hotel.rating
    }));

    res.send(topRatedRooms);
  } catch (err) {
    res.status(500).send({
      error: 'Failed to fetch top-rated rooms',
      message: err.message
    });
  }
});

// booking date update api
app.put('/visitors/:id', async (req, res) => {
  const id = req.params.id;
  const filter = { _id: new ObjectId(id) }
  const { checkInDate, checkOutDate } = req.body;
  const updatedDoc = {
    $set: {
      checkInDate: new Date(checkInDate),
      checkOutDate: new Date(checkOutDate),
    },
  }
  const result = await guestsCollection.updateOne(filter, updatedDoc);
  res.send(result);
})
// cancel booking api
app.delete('/visitors/:id', async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) }
  const result = await guestsCollection.deleteOne(query)
  res.send(result);
})

// Mark payment and store history
    app.post('/payments', async (req, res) => {
      const { id, transactionId, amount, email, paymentMethod } = req.body;

      try {

        // Insert payment history
        const paymentEntry = {
          hotelsId: new ObjectId(id),
          transactionId,
          amount,
          email,
          paid_at: new Date(),
          paid_at_string: new Date().toISOString(),
          paymentMethod
        };

        const paymentResult = await paymentsCollection.insertOne(paymentEntry);

        // if (paymentResult.insertedId) {
        //   const updateResult = await addClassCollection.updateOne(
        //     { _id: new ObjectId(courseId) },
        //     { $inc: { enrollmentCount: 1 } }
        //   );

        // }

        res.status(201).send({
          message: 'Payment recorded successfully',
          insertedId: paymentResult.insertedId,

        });
        // res.json({ success: true, message: 'Payment recorded successfully' });
      } catch (error) {
        console.error('Payment processing error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
      }
    });

    // payment intent API
    app.post('/create-payment-intent', async (req, res) => {
      const amountInCents = req.body.amountInCents
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountInCents, // Amount in cents
          currency: 'usd',
          payment_method_types: ['card'],
        });

        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      } catch (error) {
        res.status(400).send({ error: error.message });
      }
    });



// Send a ping to confirm a successful connection
// await client.db("admin").command({ ping: 1 });
// console.log("Pinged your deployment. You successfully connected to MongoDB!");

app.get('/', (req, res) => {
  res.send('running hotet booking server site')
})
app.listen(port, () => {
  console.log(`hotet booking server is running on port: ${port}`)
})


