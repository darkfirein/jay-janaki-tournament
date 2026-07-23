# Jay Janaki Tournament Centre — Gaming Tournament Booking Site

Ek gaming tournament website jaha users login karke tournament join kar sakte hain,
aapke QR code par UPI payment kar sakte hain, UTR number + screenshot submit kar
sakte hain. Aap (admin) payment verify karke room ID aur password bhejte hain —
sab kuch ek full admin panel (CMS) se control hota hai.

## Kya-kya bana hua hai

**User side:**
- Register / Login
- Tournament list (game, entry fee, slots, match time, prize pool)
- Tournament detail page — aapka QR code + UPI ID dikhta hai, user UTR number aur
  payment screenshot upload karta hai
- "My Bookings" — payment status (pending / approved / rejected) aur approve hone
  par room ID + password yaha dikhta hai; jeetne par winning amount bhi yahi dikhta hai
- "Results" page — sabhi completed tournaments ke winners aur unki prize amount
  public me dikhti hai

**Admin panel (full CMS):**
- Dashboard — total users, tournaments, pending approvals, revenue
- Tournaments — create / edit / delete (game, entry fee, slots, match time, map, prize pool);
  match complete hone par result summary bhi likh sakte ho
- Payment Approvals — har booking ka UTR + screenshot dekh kar Approve (room ID/password
  daal kar) ya Reject kar sakte hain; approved bookings me se winner mark karke unki
  winning amount aur rank (1st/2nd/3rd) set kar sakte hain
- Users — sab registered users ki list
- Payment Settings — apna QR code image upload karo, UPI ID aur instructions set karo

## Tech stack

- **Backend:** Node.js, Express, SQLite (file-based DB, koi separate database server
  install nahi karna padta), JWT login, Multer (screenshot/QR upload)
- **Frontend:** React (Vite), Tailwind CSS, React Router

## Setup — apne computer par chalane ke liye

Aapke computer par [Node.js](https://nodejs.org) (version 18 ya usse upar) installed
hona chahiye.

### 1. Backend chalu karo

```bash
cd backend
npm install
cp .env.example .env
```

`.env` file kholo aur `JWT_SECRET` ko kisi bhi random lambi string se replace kar do.
Yahi par apna admin email/password bhi set kar sakte ho (`ADMIN_EMAIL`, `ADMIN_PASSWORD`).

```bash
npm start
```

Backend `http://localhost:5000` par chalega. Pehli baar chalane par terminal me admin
login (email/password) print hoga — usse admin panel me login karo.

### 2. Frontend chalu karo (naye terminal me)

```bash
cd frontend
npm install
npm run dev
```

Frontend `http://localhost:5173` par khulega. Ye automatically backend se connect ho
jayega.

### 3. Admin panel use karo

1. `http://localhost:5173/login` par admin email/password se login karo
2. **Admin Panel → Payment Settings** me apna QR code image upload karo aur UPI ID daalo
3. **Admin Panel → Tournaments** me naya tournament banao (entry fee, slots, match time)
4. Jab koi user payment karke UTR + screenshot submit karega, wo **Admin Panel →
   Payment Approvals → Pending** tab me dikhega
5. Screenshot check karo, Room ID + Password daal kar **Approve** dabao — user ko
   turant "My Bookings" me room details dikhne lagenge

## Ek permanent (free) database banao — Neon.tech

Backend ab SQLite ki jagah Postgres use karta hai, taki Render redeploy/restart hone
par bhi data (users, tournaments, bookings) delete na ho.

1. [neon.tech](https://neon.tech) par GitHub se sign up karo (free, koi credit card
   nahi chahiye)
2. **"Create a project"** dabao, koi bhi naam do, region select karo, **Create** dabao
3. Dashboard par **"Connection string"** milega — kuch aisा dikhega:
   ```
   postgresql://username:password@ep-xxxx.region.aws.neon.tech/dbname?sslmode=require
   ```
   Isse **poora copy** kar lo

4. Render dashboard par apni backend service kholo → **Environment** tab → naya
   environment variable add karo:
   - Key: `DATABASE_URL`
   - Value: wahi connection string jo Neon se copy kiya

5. **Save** dabao — Render service automatically restart hoga naye database ke saath.
   Terminal logs me admin account create hone ka message dikhega (pehli baar).

Ab chahe kitni baar bhi code push karo aur Render redeploy ho, data safe rahega —
sirf Neon ka database delete karne par hi data jayega.

## Deploy online for free — Render (backend) + Vercel (frontend)

### 1. Code ko GitHub par upload karo

Termux me (project folder ke andar):
```bash
git init
git add .
git commit -m "Jay Janaki Tournament Centre"
```
Phone browser se [github.com](https://github.com) par account banao aur naya repository
banao (public ya private, dono chalega). Phir:
```bash
git remote add origin https://github.com/<your-username>/<repo-name>.git
git branch -M main
git push -u origin main
```
Push karte waqt password maangega — GitHub ab normal password accept nahi karta,
iske liye GitHub Settings → Developer settings → Personal access tokens se ek token
banao aur usse password ki jagah paste karo.

### 2. Backend deploy karo — Render.com

1. [render.com](https://render.com) par GitHub se sign up karo
2. **New → Web Service** → apna repository connect karo
3. **Root Directory:** `backend`
4. **Build Command:** `npm install`
5. **Start Command:** `npm start`
6. **Environment Variables** me ye add karo:
   - `JWT_SECRET` → koi bhi lambi random string
   - `ADMIN_EMAIL` → apna admin email
   - `ADMIN_PASSWORD` → apna admin password
7. Deploy hone ke baad ek URL milega jaisे `https://jay-janaki-backend.onrender.com`
   — isse note kar lo

**Note:** Database (users, tournaments, bookings) ab Neon Postgres me safe hai — redeploy
se nahi udega. Lekin upload ki hui **screenshots aur QR code image** abhi bhi Render ke
free disk par hain, jo restart/redeploy par delete ho sakti hain. Real users ke liye
isko bhi permanent banane ke liye Cloudinary jaisi free image storage add karni padegi
— bata dena to wo bhi set up kar dunga.

### 3. Frontend deploy karo — Vercel.com

1. [vercel.com](https://vercel.com) par GitHub se sign up karo
2. **Add New → Project** → wahi repository import karo
3. **Root Directory:** `frontend`
4. Framework: Vite (apne aap detect ho jayega)
5. **Environment Variables** me add karo:
   - `VITE_API_URL` → `https://jay-janaki-backend.onrender.com/api` (Step 2 wala URL + `/api`)
6. Deploy dabao — kuch minute me live URL milega jaisे `https://jay-janaki.vercel.app`

Bas! Ye URL kisi ko bhi bhejo, wo bina Termux/phone ke seedha browser me website
use kar sakta hai.


## Important security notes

- `.env` file me `JWT_SECRET` zaroor change karo, default rakhna unsafe hai
- Default admin password bhi turant login karke change kar lo (abhi ke version me
  password change ka UI nahi hai — chaho to main add kar sakta hoon)
- Screenshots aur QR image `backend/uploads/` folder me save hote hain — deploy karte
  waqt is folder ka backup zaroor lena, warna server restart par purani screenshots
  reference toot sakti hain (iske liye cloud storage jaisa Cloudinary bhi laga sakte hain)
