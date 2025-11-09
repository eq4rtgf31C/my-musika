document.addEventListener('DOMContentLoaded', function() {
 const cards = document.querySelectorAll('.music-card');
 
 cards.forEach(card => {
 const img = card.querySelector('.music-image');
 const title = card.querySelector('.music-title');
 const artist = card.querySelector('.music-artist');
 const description = card.querySelector('.music-description');
 const canvas = document.createElement('canvas');
 const ctx = canvas.getContext('2d');
 
 img.onload = function() {
 canvas.width = img.naturalWidth;
 canvas.height = img.naturalHeight;
 
 ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
 
 const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
 const data = imageData.data;
 let r = 0, g = 0, b = 0, count = 0;
 for (let i = 0; i < data.length; i += 16) {
 r += data[i];
 g += data[i + 1];
 b += data[i + 2];
 count++;
 }
     
 r = Math.floor(r / count);
 g = Math.floor(g / count);
 b = Math.floor(b / count);
 
 const dominantColor = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
 applyColorToCard(card, dominantColor, r, g, b);
 };
     
 if (img.complete) {
     img.onload();
 }
 });
 
 function applyColorToCard(card, color, r, g, b) {
const brightness = (r * 299 + g * 587 + b * 114) / 1000;
const textColor = brightness > 128 ? '#000000' : '#FFFFFF';
const darkColor = `rgb(${Math.max(0, r - 40)}, ${Math.max(0, g - 40)}, ${Math.max(0, b - 40)})`;
card.style.background = `linear-gradient(135deg, ${color}, ${darkColor})`;
card.style.borderColor = color;
card.style.boxShadow = `0 10px 30px ${color}40`;
const title = card.querySelector('.music-title');
const artist = card.querySelector('.music-artist');
const description = card.querySelector('.music-description');

if (title) title.style.color = textColor;
if (artist) artist.style.color = brightness > 128 ? '#8B0000' : '#FF6B6B';
if (description) description.style.color = brightness > 128 ? '#333333' : '#E0E0E0';
 }
});
