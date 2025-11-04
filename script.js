document.addEventListener('DOMContentLoaded', function() {
    const cards = document.querySelectorAll('.music-card');
    
    cards.forEach(card => {
        const img = card.querySelector('.music-image');
        const title = card.querySelector('.music-title');
        const artist = card.querySelector('.music-artist');
        const description = card.querySelector('.music-description');
        
        // Создаем временный canvas для анализа цвета
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        img.onload = function() {
            // Устанавливаем размер canvas как у изображения
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            
            // Рисуем изображение на canvas
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            // Получаем данные пикселей
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            // Анализируем доминирующий цвет (упрощенный алгоритм)
            let r = 0, g = 0, b = 0, count = 0;
            
            for (let i = 0; i < data.length; i += 16) { // Пропускаем пиксели для скорости
                r += data[i];
                g += data[i + 1];
                b += data[i + 2];
                count++;
            }
            
            // Вычисляем средний цвет
            r = Math.floor(r / count);
            g = Math.floor(g / count);
            b = Math.floor(b / count);
            
            // Создаем цвет в формате HEX
            const dominantColor = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
            
            // Применяем цвет к карточке
            applyColorToCard(card, dominantColor, r, g, b);
        };
        
        // Если изображение уже загружено
        if (img.complete) {
            img.onload();
        }
    });
    
    function applyColorToCard(card, color, r, g, b) {
        // Определяем яркость цвета для выбора текста (светлый/темный)
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        const textColor = brightness > 128 ? '#000000' : '#FFFFFF';
        
        // Создаем более темную версию для градиента
        const darkColor = `rgb(${Math.max(0, r - 40)}, ${Math.max(0, g - 40)}, ${Math.max(0, b - 40)})`;
        
        // Применяем стили
        card.style.background = `linear-gradient(135deg, ${color}, ${darkColor})`;
        card.style.borderColor = color;
        card.style.boxShadow = `0 10px 30px ${color}40`;
        
        // Меняем цвет текста в зависимости от фона
        const title = card.querySelector('.music-title');
        const artist = card.querySelector('.music-artist');
        const description = card.querySelector('.music-description');
        
        if (title) title.style.color = textColor;
        if (artist) artist.style.color = brightness > 128 ? '#8B0000' : '#FF6B6B';
        if (description) description.style.color = brightness > 128 ? '#333333' : '#E0E0E0';
    }
});