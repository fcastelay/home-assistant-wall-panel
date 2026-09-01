# Créditos de las fotos de fondo

Bajadas con `node scripts/ecowitt/bajar-fondos.mjs`.

Vienen de [Picsum](https://picsum.photos), que sirve fotografías de
[Unsplash](https://unsplash.com). La licencia de Unsplash permite usarlas, incluso
comercialmente, sin pedir permiso y sin exigir atribución. **Se atribuye igual**: cuesta una
línea y es lo correcto.

| Archivo | Autor | Original |
|---|---|---|
| `fondo-1015-*.webp` | Alexey Topolyanskiy | [-oWyJoSqBRM](https://unsplash.com/photos/-oWyJoSqBRM) |
| `fondo-1018-*.webp` | Andrew Ridley | [Kt5hRENuotI](https://unsplash.com/photos/Kt5hRENuotI) |
| `fondo-1036-*.webp` | Wolfgang Lutz | [yOujaSETXlo](https://unsplash.com/photos/yOujaSETXlo) |
| `fondo-1043-*.webp` | Christian Joudrey | [mWRR1xj95hg](https://unsplash.com/photos/mWRR1xj95hg) |
| `fondo-1053-*.webp` | Anna Popović | [x7HJdJZqplo](https://unsplash.com/photos/x7HJdJZqplo) |

## Si las cambiás

Corré el script con otros ids y este archivo se regenera:

```
node scripts/ecowitt/bajar-fondos.mjs 1016 1043 984 1024
```

O poné fotos propias en esta carpeta con el mismo nombre y borrá las filas de acá. Fotos
propias del cielo de tu casa quedan mejor que cualquier banco de imágenes, y no tienen
ninguna letra chica.

## Peso

El portal rota cuatro fondos con transición. Si los cuatro se cargan de entrada son casi
un megabyte en la primera visita, y este panel suele vivir en una tablet vieja colgada en
la pared. **Cargar sólo el primero y los otros tres en diferido.**
