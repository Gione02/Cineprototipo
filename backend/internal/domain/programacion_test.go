package domain

import "testing"

// Duraciones de db/init.sql (minutos).
var duracionesDemo = map[string]int{
	"the-batman": 176, "avatar-agua": 192, "gladiador": 155, "dark-knight": 152, "deadpool-wolverine": 128, "dune-2": 166,
	"intensa-mente-2": 96, "oppenheimer": 180, "top-gun-maverick": 130, "whiplash": 106, "todo-en-todas-partes": 139,
	"matrix": 136, "alien-romulus": 119, "furiosa": 148, "civil-war": 109, "planeta-simios": 145,
}

func TestCadaPeliculaTieneAlMenosCincoFunciones(t *testing.T) {
	for paridad := 0; paridad < 2; paridad++ {
		porPelicula := map[string]int{}
		primera := map[string]int{}
		ultima := map[string]int{}
		for _, ps := range Plan {
			for _, f := range FuncionesDelDia(ps, paridad, func(p string) int { return duracionesDemo[p] }) {
				porPelicula[f.Pelicula]++
				if v, ok := primera[f.Pelicula]; !ok || f.Minuto < v {
					primera[f.Pelicula] = f.Minuto
				}
				ultima[f.Pelicula] = max(ultima[f.Pelicula], f.Minuto)
				if f.Minuto > UltimaFuncionMin {
					t.Errorf("%s: función a las %d:%02d, después del cierre", ps.Sala, f.Minuto/60, f.Minuto%60)
				}
			}
		}
		for p := range duracionesDemo {
			if primera[p] != PrimeraFuncionMin {
				t.Errorf("día %d: %s empieza a las %d:%02d, debe tener función a las 10:00", paridad, p, primera[p]/60, primera[p]%60)
			}
			if ultima[p] < 21*60 {
				t.Errorf("día %d: la última función de %s es a las %d:%02d, debe llegar a la noche", paridad, p, ultima[p]/60, ultima[p]%60)
			}
		}
		if len(porPelicula) != len(duracionesDemo) {
			t.Errorf("día %d: se programaron %d películas, se esperaban %d", paridad, len(porPelicula), len(duracionesDemo))
		}
		for p, n := range porPelicula {
			if n < MinFuncionesDiarias {
				t.Errorf("día %d: %s tiene %d funciones, mínimo %d", paridad, p, n, MinFuncionesDiarias)
			}
		}
	}
}

func TestFuncionesDelDiaEncadenaConLimpieza(t *testing.T) {
	dur := map[string]int{"dune-2": 166, "top-gun-maverick": 130}
	fs := FuncionesDelDia(Plan[0], 0, func(p string) int { return dur[p] })

	// 10:00 Duna (166 + 20 = 13:06 → 13:15), Top Gun (→ 15:45), Duna (→ 19:00), Top Gun (→ 21:30); la siguiente pasaría de las 22:00.
	minutos := []int{600, 795, 945, 1140, 1290}
	if len(fs) != len(minutos) {
		t.Fatalf("se esperaban %d funciones, hubo %d", len(minutos), len(fs))
	}
	for i, f := range fs {
		if f.Minuto != minutos[i] {
			t.Errorf("función %d empieza en el minuto %d, se esperaba %d", i, f.Minuto, minutos[i])
		}
		esperada := Plan[0].Peliculas[i%2]
		if f.Pelicula != esperada {
			t.Errorf("función %d proyecta %s, se esperaba %s", i, f.Pelicula, esperada)
		}
	}
	if fs[0].Precio != 60 || fs[1].Precio != 70 {
		t.Errorf("la matiné (antes de las 13:00) debe costar 10 créditos menos: %d y %d", fs[0].Precio, fs[1].Precio)
	}

	impar := FuncionesDelDia(Plan[0], 1, func(p string) int { return dur[p] })
	if impar[0].Pelicula != "top-gun-maverick" {
		t.Errorf("los días impares abre la segunda película, abrió %s", impar[0].Pelicula)
	}
}
