from PIL import Image, ImageDraw

# Abrir la imagen original
img = Image.open("frontend/src/assets/BEEXOCCER.png").convert("RGBA")

# Obtener dimensiones
width, height = img.size
print(f"Tamaño original: {width}x{height}")

# La pelota está en el centro del logo BEEXOCCER
center_x = width // 2 + 25  # Ajustado 25 a la derecha
center_y = height // 2

# Radio de la pelota (ajustado para capturar solo la pelota)
ball_radius = 42  # Reducido para ajustar mejor

# Calculamos las coordenadas de recorte (cuadrado que contiene el círculo)
left = center_x - ball_radius
top = center_y - ball_radius
right = center_x + ball_radius
bottom = center_y + ball_radius

print(f"Centro: ({center_x}, {center_y})")
print(f"Radio: {ball_radius}")
print(f"Recortando: ({left}, {top}) a ({right}, {bottom})")

# Recortar la región cuadrada
ball_square = img.crop((left, top, right, bottom))
ball_size = ball_radius * 2

# Crear máscara circular
mask = Image.new("L", (ball_size, ball_size), 0)
draw = ImageDraw.Draw(mask)
draw.ellipse((0, 0, ball_size - 1, ball_size - 1), fill=255)

# Aplicar máscara circular
ball_circular = Image.new("RGBA", (ball_size, ball_size), (0, 0, 0, 0))
ball_circular.paste(ball_square, (0, 0), mask)

# Guardar
ball_circular.save("frontend/src/assets/ball.png")
print("Pelota circular guardada en frontend/src/assets/ball.png")

# Versión 100x100
ball_100 = ball_circular.resize((100, 100), Image.Resampling.LANCZOS)
ball_100.save("frontend/src/assets/ball-100.png")
print("Pelota 100x100 guardada en frontend/src/assets/ball-100.png")

# Versión 200x200 para mejor calidad
ball_200 = ball_circular.resize((200, 200), Image.Resampling.LANCZOS)
ball_200.save("frontend/src/assets/ball-200.png")
print("Pelota 200x200 guardada en frontend/src/assets/ball-200.png")
