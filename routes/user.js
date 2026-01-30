var express = require('express');
var router = express.Router();
var db = require("../config/connection");
var collection = require("../config/collection");
const { ObjectId } = require("mongodb");
const productHelpers = require('../helpers/product-helpers');
const userHelpers = require('../helpers/user-helper');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const { verifyJWT, optionalAuth } = require('../middleware/jwtAuth');
/* GET home page. */

// Public homepage; if user has a valid token we set cartCount using req.user
router.get('/', optionalAuth, async function(req, res, next) {
  try {
    let user = req.user || null;
    let cartCount = null;
    if (user) {
      cartCount = await userHelpers.getCartCount(user._id);
    }
    const products = await productHelpers.getAllProducts();
    res.render('user/view-products', { products, user, cartCount });
  } catch (err) {
    console.error('Home route error:', err);
    res.status(500).send('Internal Server Error');
  }
});

router.get('/login', (req, res) => {
  res.render('user/login', { loginError: false });
});

router.get('/signup', (req, res) => {
  res.render('user/signup');
});

router.post('/signup', async (req, res) => {
  try {
    // Do not log entire req.body in production (may contain passwords)
    const result = await userHelpers.doSignup(req.body);
    const payload = { _id: result.insertedId, email: req.body.email };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
    res.redirect('/login');
  } catch (err) {
    console.error('Signup error:', err);
    res.render('user/signup', {
      signupError: err.message || 'Something went wrong',
      formData: req.body
    });
  }

});

router.post('/login', async (req, res) => {
  try {
    const response = await userHelpers.doLogin(req.body);
    if (response.status) {
      // Minimal payload in token
      const payload = { _id: response.user._id.toString(), Email: response.user.Email };
      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
      });
      return res.redirect('/');
    } else {
      return res.render('user/login', { loginError: true });
    }
  } catch (err) {
    console.error('Login error:', err);
  }
});

router.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/');
});
router.get('/forgot-password',(req,res)=>{
   res.render('user/forgot-password');
});

router.post('/forgot-password', async (req, res) => {
  try {
    const email = req.body.Email;
    
    let response = await userHelpers.generateOTP(email);

    if (response.status) {
      // 2. Configure Nodemailer (Use your real credentials here)
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.Email, 
          pass: process.env.password   
        }
      });

      // 3. Define the Email content
      const mailOptions = {
        from: 'MobileCart',
        to: email,
        subject: "Your Password Reset OTP",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; padding: 20px; border-radius: 10px;">
            <h2 style="color: #2563eb; text-align: center;">Password Reset</h2>
            <p>You requested a password reset. Please use the OTP code below to proceed:</p>
            <div style="background: #f3f4f6; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 10px; color: #1f2937; border-radius: 8px; margin: 20px 0;">
              ${response.otp}
            </div>
            <p style="color: #6b7280; font-size: 14px;">This code is valid for 5 minutes. If you did not request this, please ignore this email.</p>
          </div>
        `
      };

      // 4. Send the Email
      await transporter.sendMail(mailOptions);

      // 5. Render the OTP entry page
      res.render('user/enter-otp', { Email:email });

    } else {
      res.render('user/forgot-password', { error: "Email not found" });
    }
  } catch (error) {
    console.error("Mail Error:", error);
    res.render('user/forgot-password', { error: "Failed to send OTP. Please try again." });
  }
});

router.post('/reset-password', async (req, res) => {
  let status = await userHelpers.verifyAndResetPassword(req.body);
  if (status.status) {
    res.redirect('/login');
  } else {
     res.render('user/enter-otp', { 
      error: "Invalid OTP", 
      Email: req.body.Email 
    });
  }
});

router.get('/cart', verifyJWT, async (req, res) => {
  try {
    const userId = req.user._id;
    const products = await userHelpers.getcartProduct(userId);
    const totalValue = await userHelpers.getTotalAmount(userId);
    res.render('user/cart', { products, user: { _id: userId }, totalValue });
  } catch (err) {
    console.error('Cart error:', err);
    res.status(500).send('Internal Server Error');
  }
});

router.get('/add-to-cart/:id', verifyJWT, (req, res) => {
  const productId = req.params.id;
  const userId = req.user._id;
  userHelpers.addToCart(productId, userId)
    .then(() => res.json({ status: true }))
    .catch(err => {
      console.error('Add to cart error:', err);
      res.status(500).json({ status: false });
    });
});

router.post('/change-product-quantity', verifyJWT, (req, res, next) => {
  // Ensure server trusts session user, not client-supplied user id
  const payload = { ...req.body, user: req.user._id };
  userHelpers.changeProductQuantity(payload)
    .then(async (response) => {
      response.total = await userHelpers.getTotalAmount(req.user._id);
      res.json(response);
    })
    .catch(err => {
      console.error('Change quantity error:', err);
      res.status(500).json({ error: 'Failed' });
    });
});

router.post('/remove-from-cart', verifyJWT, (req, res) => {
  const payload = { ...req.body, user: req.user._id };
  userHelpers.removeFromCart(payload)
    .then((response) => res.json(response))
    .catch(err => {
      console.error('Remove from cart error:', err);
      res.status(500).json({ error: 'Failed' });
    });
});

router.get('/place-order', verifyJWT, async (req, res) => {
  try {
    const userId = req.user._id;
    let total = await userHelpers.getTotalAmount(userId);
    res.render('user/place-order', { total, user: { _id: userId } });
  } catch (err) {
    console.error('Place order page error:', err);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/place-order', verifyJWT, async (req, res) => {
  try {
    const userId = req.user._id;
    let products = await userHelpers.getCartProductList(userId);
    let totalPrice = await userHelpers.getTotalAmount(userId);
    userHelpers.placeOrder({ ...req.body, userId }, products, totalPrice).then((response) => {
      res.render('user/order-success', { orderId: response.orderId, user: { _id: userId } });
    }).catch(err => {
      console.error('Place order error:', err);
      res.status(500).send('Failed to place order');
    });
  } catch (err) {
    console.error('Place order error:', err);
    res.status(500).send('Internal Server Error');
  }
});

router.get('/order-success', verifyJWT, (req, res) => {
  res.render('user/order-success', { user: { _id: req.user._id } });
});

router.get('/orders', verifyJWT, async (req, res) => {
  try {
    const orders = await userHelpers.getUserOrders(req.user._id);
    res.render('user/orders', { user: { _id: req.user._id }, orders });
  } catch (err) {
    console.error('Orders error:', err);
    res.status(500).send('Internal Server Error');
  }
});

router.get('/order-details/:id', verifyJWT, async (req, res) => {
  try {
    let orderId = req.params.id;
    // Ensure order exists and belongs to the logged-in user
    let orderDetails = await db.get().collection(collection.ORDER_COLLECTION).findOne({ _id: new ObjectId(orderId) });
    if (!orderDetails) return res.status(404).send('Order not found');
    if (orderDetails.userId.toString() !== req.user._id.toString()) {
      return res.status(403).send('Forbidden');
    }
    let orderProducts = await userHelpers.getOrderProducts(orderId);
    let products = orderProducts.map(op => ({
      name: op.product.Name,
      price: op.product.Price,
      quantity: op.quantity
    }));
    res.render('user/order-details', { user: { _id: req.user._id }, orderDetails, products });
  } catch (error) {
    console.error("Order details error:", error);
    res.status(500).send('Internal Server Error');
  }
});

// Filter setting (public)
router.get('/view-products', optionalAuth, async (req, res) => {
  try {
    let filterData = {
      brand: req.query.brand || "",
      price: req.query.price || "",
      sort: req.query.sort || ""
    };
    let [products, brands] = await Promise.all([
      productHelpers.getFilteredProducts(filterData),
      productHelpers.getAllBrands()
    ]);
    res.render('user/view-products', {
      products,
      brands,
      brandsCount: brands.length,
      selectedBrand: filterData.brand,
      selectedPrice: filterData.price,
      selectedSort: filterData.sort,
      user: req.user || null
    });
  } catch (err) {
    console.error("Filter Error:", err);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;
