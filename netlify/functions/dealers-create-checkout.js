const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    // Create the Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          // This pulls the Price ID from your Netlify Dashboard
          price: process.env.STRIPE_DEALER_PRICE_ID,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      // These redirect the user back to your site after paying
      success_url: `${process.env.URL}/dealers-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.URL}/dealers.html`,
    });

    return { statusCode: 200, body: JSON.stringify({ url: session.url }) };

  } catch (error) {
    console.error("Stripe Error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};