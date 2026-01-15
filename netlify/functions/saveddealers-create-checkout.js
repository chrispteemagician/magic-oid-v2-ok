const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const data = JSON.parse(event.body);
    
    // Check if Stripe Key is set
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("Stripe Secret Key is missing in Netlify Settings.");
    }

    // Determine Price ID (Use Founder Tier by default)
    // You can also pass 'tier' in the body to select different prices
    const priceId = process.env.STRIPE_FOUNDER_PRICE_ID || process.env.STRIPE_DEALER_PRICE_ID;
    
    if (!priceId) {
      throw new Error("Stripe Price ID is missing. Check Environment Variables.");
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      // Dynamic Success/Cancel URLs based on where the app is running
      success_url: `${process.env.URL}/dealers/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.URL}/dealers/index.html`,
      // Add metadata so you know who signed up
      metadata: {
        business_name: data.business || "Unknown Shop",
        email: data.email
      },
      customer_email: data.email // Pre-fill email for user
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };

  } catch (error) {
    console.error("Stripe Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};