# -*- coding: utf-8 -*-
"""Kuratierte Start-Themenliste fuer 'Erforschen'. Reine Referenzen, kein
erfundener Text - Wortlaut kommt zur Laufzeit aus der Datenbank.

Farbe verweist auf die Design-Token-Namen aus dem Design-System (Punkt 4).
"""

TOPICS = [
    {
        "name": "Glaube",
        "farbe": "gelb",
        "verses": [
            ("HEB", 11, 1), ("ROM", 10, 17), ("MRK", 9, 24),
            ("JAS", 2, 17), ("MAT", 17, 20),
        ],
    },
    {
        "name": "Liebe",
        "farbe": "rose",
        "verses": [
            ("1CO", 13, 4), ("1CO", 13, 13), ("JHN", 13, 34),
            ("1JN", 4, 8), ("ROM", 5, 8),
        ],
    },
    {
        "name": "Hoffnung",
        "farbe": "salbei",
        "verses": [
            ("JER", 29, 11), ("ROM", 15, 13), ("ROM", 8, 24),
            ("PSA", 42, 6), ("HEB", 6, 19),
        ],
    },
    {
        "name": "Angst und Sorge",
        "farbe": "blau_hell",
        "verses": [
            ("PHP", 4, 6), ("MAT", 6, 25), ("1PE", 5, 7),
            ("ISA", 41, 10), ("PSA", 55, 22),
        ],
    },
    {
        "name": "Vergebung",
        "farbe": "lavendel",
        "verses": [
            ("EPH", 4, 32), ("MAT", 6, 14), ("1JN", 1, 9),
            ("COL", 3, 13), ("PSA", 103, 12),
        ],
    },
    {
        "name": "Ehe",
        "farbe": "apricot",
        "verses": [
            ("EPH", 5, 25), ("GEN", 2, 24), ("1CO", 13, 4),
            ("PRO", 18, 22), ("MAL", 2, 16),
        ],
    },
    {
        "name": "Weisheit",
        "farbe": "blau",
        "verses": [
            ("JAS", 1, 5), ("PRO", 1, 7), ("PRO", 3, 5),
            ("1CO", 1, 25), ("ECC", 7, 12),
        ],
    },
    {
        "name": "Geduld",
        "farbe": "bibel",
        "verses": [
            ("JAS", 1, 3), ("ROM", 12, 12), ("GAL", 6, 9),
            ("PSA", 37, 7), ("ECC", 7, 8),
        ],
    },
    {
        "name": "Dankbarkeit",
        "farbe": "creme",
        "verses": [
            ("1TH", 5, 18), ("PSA", 100, 4), ("COL", 3, 17),
            ("PHP", 4, 6), ("PSA", 107, 1),
        ],
    },
    {
        "name": "Trost",
        "farbe": "blau_weich",
        "verses": [
            ("2CO", 1, 3), ("PSA", 34, 18), ("MAT", 5, 4),
            ("ISA", 66, 13), ("PSA", 147, 3),
        ],
    },
    {
        "name": "Gebet",
        "farbe": "salbei",
        "verses": [
            ("MAT", 6, 6), ("1TH", 5, 17), ("PHP", 4, 6),
            ("JAS", 5, 16), ("JHN", 15, 7),
        ],
    },
    {
        "name": "Gnade",
        "farbe": "gelb",
        "verses": [
            ("EPH", 2, 8), ("ROM", 3, 23), ("ROM", 3, 24),
            ("2CO", 12, 9), ("TIT", 2, 11),
        ],
    },
]
