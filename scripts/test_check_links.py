import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from check_links import HTML_PATH, extract_items


class CatalogLinkExtractionTests(unittest.TestCase):
    def test_only_verified_download_apps_remain_listed(self):
        source = HTML_PATH.read_text(encoding="utf-8")
        sites = extract_items(source, "S")
        apps = extract_items(source, "A")
        music = extract_items(source, "M")

        self.assertGreater(len(sites), 0, "website catalog must be checked")
        self.assertGreater(len(apps), 0, "movie apps must be checked")
        self.assertGreater(len(music), 0, "music apps must be checked")

        # PvrPlay remains available as a website; its app entry was removed
        # because a direct APK download URL could not be verified.
        self.assertIn("PvrPlay", {item["name"] for item in sites})

        movie_names = {item["name"] for item in apps}
        music_names = {item["name"] for item in music}
        for name in ("FilmTV", "Nuvix", "NetMirror", "PvrPlay", "Hdghartv"):
            with self.subTest(movie_app=name):
                self.assertNotIn(name, movie_names)
        self.assertNotIn("BitChord", music_names)

        self.assertIn("CineHD", movie_names)
        self.assertIn("Echo Music", music_names)

    def test_property_order_does_not_matter(self):
        source = '''
const A=[
{appType:"movie",name:"Movie App",url:"https://movie.example/",domain:"movie.example"},
];
'''
        self.assertEqual(
            extract_items(source, "A"),
            [{"name": "Movie App", "url": "https://movie.example/", "domain": "movie.example"}],
        )

    def test_download_urls_and_formats_are_extracted(self):
        source = '''
const M=[
{appType:"music",name:"Player",url:"https://player.example/",downloadUrl:"https://cdn.example/app.xapk",downloadDirect:true,downloadFormat:"XAPK",domain:"player.example"},
];
'''
        self.assertEqual(
            extract_items(source, "M"),
            [{
                "name": "Player",
                "url": "https://player.example/",
                "domain": "player.example",
                "download_url": "https://cdn.example/app.xapk",
                "download_direct": True,
                "download_format": "XAPK",
            }],
        )

    def test_every_seeded_app_has_an_explicit_direct_download(self):
        source = HTML_PATH.read_text(encoding="utf-8")
        for array_name in ("A", "M"):
            for item in extract_items(source, array_name):
                with self.subTest(array_name=array_name, name=item["name"]):
                    self.assertTrue(item.get("download_url"), f"{item['name']} needs a download URL")
                    self.assertIs(item.get("download_direct"), True, f"{item['name']} must be explicitly marked direct")
                    self.assertIn(item.get("download_format", "APK"), ("APK", "XAPK"))

    def test_missing_category_raises_a_clear_error(self):
        with self.assertRaisesRegex(RuntimeError, "Could not find the M catalog array"):
            extract_items("const S=[\n];", "M")


if __name__ == "__main__":
    unittest.main(verbosity=2)
