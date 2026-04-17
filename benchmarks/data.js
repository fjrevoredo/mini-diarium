window.BENCHMARK_DATA = {
  "lastUpdate": 1776407935122,
  "repoUrl": "https://github.com/fjrevoredo/mini-diarium",
  "entries": {
    "Benchmark": [
      {
        "commit": {
          "author": {
            "email": "fjrevoredo@gmail.com",
            "name": "Francisco J. Revoredo",
            "username": "fjrevoredo"
          },
          "committer": {
            "email": "fjrevoredo@gmail.com",
            "name": "Francisco J. Revoredo",
            "username": "fjrevoredo"
          },
          "distinct": true,
          "id": "80bb8dfa60f71673ada4cc78e1541745c6731137",
          "message": "fix #3",
          "timestamp": "2026-03-30T01:20:54+02:00",
          "tree_id": "9cde2367fec64ba9df2513533400d87a6adf6482",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/80bb8dfa60f71673ada4cc78e1541745c6731137"
        },
        "date": 1774829107985,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 122562304,
            "range": "± 2382216",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 119857079,
            "range": "± 4326803",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 1831,
            "range": "± 20",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 12715,
            "range": "± 40",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 125483,
            "range": "± 360",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1462,
            "range": "± 5",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 12299,
            "range": "± 26",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 123158,
            "range": "± 521",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 791435,
            "range": "± 88926",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 589355,
            "range": "± 27717",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 9482,
            "range": "± 34",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 28893,
            "range": "± 126",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 120760,
            "range": "± 260",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 124423,
            "range": "± 438",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 582477,
            "range": "± 1130",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 6712,
            "range": "± 273",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 9626,
            "range": "± 69",
            "unit": "ns/iter"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "41898282+github-actions[bot]@users.noreply.github.com",
            "name": "github-actions[bot]",
            "username": "github-actions[bot]"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "2889c5737c5d0a87a6d78cae6b07da26575229ba",
          "message": "chore(release): clear latest changelog after v0.4.14\n\nAutomated cleanup PR created after publishing v0.4.14. Removes\nlatest-changelog.md so the next release must create a fresh copy from\nlatest-changelog.example.md.\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-03-30T14:46:16+02:00",
          "tree_id": "daa16d12f8e383b1831f5b905e70f2e250eb1f76",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/2889c5737c5d0a87a6d78cae6b07da26575229ba"
        },
        "date": 1774875186144,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 104879454,
            "range": "± 1032400",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 103889541,
            "range": "± 1186728",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 1816,
            "range": "± 130",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 12826,
            "range": "± 139",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 125181,
            "range": "± 172",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1435,
            "range": "± 2",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 12276,
            "range": "± 14",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 122754,
            "range": "± 402",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 830217,
            "range": "± 204627",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 600079,
            "range": "± 59598",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 9528,
            "range": "± 36",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 28989,
            "range": "± 65",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 120343,
            "range": "± 640",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 123288,
            "range": "± 3665",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 578588,
            "range": "± 1676",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 6697,
            "range": "± 15",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 9592,
            "range": "± 12",
            "unit": "ns/iter"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "fjrevoredo@gmail.com",
            "name": "Francisco J. Revoredo",
            "username": "fjrevoredo"
          },
          "committer": {
            "email": "fjrevoredo@gmail.com",
            "name": "Francisco J. Revoredo",
            "username": "fjrevoredo"
          },
          "distinct": true,
          "id": "3b2bfce6c79c8f9f7ff9a9d8e9f2cb71809d7fb3",
          "message": "update docs for linux",
          "timestamp": "2026-03-31T00:29:14+02:00",
          "tree_id": "31e5fff0fb1a44d624c6a82cdf6bc16375546c2e",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/3b2bfce6c79c8f9f7ff9a9d8e9f2cb71809d7fb3"
        },
        "date": 1774910194823,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 99998851,
            "range": "± 663666",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 100911630,
            "range": "± 1299976",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 2104,
            "range": "± 4",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 14064,
            "range": "± 12",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 167626,
            "range": "± 1283",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1615,
            "range": "± 4",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 13403,
            "range": "± 595",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 132279,
            "range": "± 2679",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 1379226,
            "range": "± 536248",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 1117500,
            "range": "± 155413",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 13979,
            "range": "± 47",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 31423,
            "range": "± 157",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 125774,
            "range": "± 519",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 145546,
            "range": "± 6594",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 671321,
            "range": "± 3314",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 8976,
            "range": "± 53",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 11559,
            "range": "± 88",
            "unit": "ns/iter"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "fjrevoredo@gmail.com",
            "name": "Francisco J. Revoredo",
            "username": "fjrevoredo"
          },
          "committer": {
            "email": "fjrevoredo@gmail.com",
            "name": "Francisco J. Revoredo",
            "username": "fjrevoredo"
          },
          "distinct": true,
          "id": "2737c02b96855240122c7bb3586a1f0276fdf439",
          "message": "add promotional images for flatpak",
          "timestamp": "2026-03-31T00:55:36+02:00",
          "tree_id": "4fad0b94126c1aa5f039149c947c3e22847e17df",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/2737c02b96855240122c7bb3586a1f0276fdf439"
        },
        "date": 1774911756646,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 98155944,
            "range": "± 781632",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 99980488,
            "range": "± 1968499",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 2116,
            "range": "± 23",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 14116,
            "range": "± 84",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 167861,
            "range": "± 308",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1585,
            "range": "± 1",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 13419,
            "range": "± 35",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 132161,
            "range": "± 369",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 1096811,
            "range": "± 195481",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 875111,
            "range": "± 45000",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 14124,
            "range": "± 75",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 34033,
            "range": "± 166",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 123093,
            "range": "± 8367",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 145249,
            "range": "± 628",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 670079,
            "range": "± 9345",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 8934,
            "range": "± 24",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 11492,
            "range": "± 90",
            "unit": "ns/iter"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "fjrevoredo@gmail.com",
            "name": "Francisco J. Revoredo",
            "username": "fjrevoredo"
          },
          "committer": {
            "email": "fjrevoredo@gmail.com",
            "name": "Francisco J. Revoredo",
            "username": "fjrevoredo"
          },
          "distinct": true,
          "id": "b1add62369fcf991c2fdef3006446b1775179acf",
          "message": "link images to flatpak config",
          "timestamp": "2026-03-31T01:02:53+02:00",
          "tree_id": "8031c38b01172a5c9d82a6148ee8dd505bf57f3f",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/b1add62369fcf991c2fdef3006446b1775179acf"
        },
        "date": 1774912222950,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 130180020,
            "range": "± 1905707",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 131316452,
            "range": "± 994370",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 1819,
            "range": "± 24",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 12755,
            "range": "± 32",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 125320,
            "range": "± 617",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1485,
            "range": "± 23",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 12317,
            "range": "± 24",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 123121,
            "range": "± 940",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 819934,
            "range": "± 100493",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 661397,
            "range": "± 42849",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 9447,
            "range": "± 128",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 28736,
            "range": "± 144",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 120232,
            "range": "± 340",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 124145,
            "range": "± 1033",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 579746,
            "range": "± 2479",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 6710,
            "range": "± 37",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 9614,
            "range": "± 51",
            "unit": "ns/iter"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "fjrevoredo@gmail.com",
            "name": "Francisco J. Revoredo",
            "username": "fjrevoredo"
          },
          "committer": {
            "email": "fjrevoredo@gmail.com",
            "name": "Francisco J. Revoredo",
            "username": "fjrevoredo"
          },
          "distinct": true,
          "id": "dc82512dcc2886ee29719cc885bd9b1aaf0c3854",
          "message": "update flatpak package name",
          "timestamp": "2026-03-31T01:37:16+02:00",
          "tree_id": "6dffe92a70206aa26cba6a29ae363aab66c4443d",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/dc82512dcc2886ee29719cc885bd9b1aaf0c3854"
        },
        "date": 1774914280807,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 95463085,
            "range": "± 146906",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 96141003,
            "range": "± 167031",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 2109,
            "range": "± 57",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 14074,
            "range": "± 21",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 167761,
            "range": "± 147",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1626,
            "range": "± 3",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 13401,
            "range": "± 23",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 132189,
            "range": "± 132",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 986323,
            "range": "± 104793",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 823698,
            "range": "± 30446",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 14070,
            "range": "± 51",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 33773,
            "range": "± 134",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 124189,
            "range": "± 539",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 144081,
            "range": "± 908",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 661497,
            "range": "± 8664",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 8961,
            "range": "± 33",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 11480,
            "range": "± 26",
            "unit": "ns/iter"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "fjrevoredo@gmail.com",
            "name": "Francisco J. Revoredo",
            "username": "fjrevoredo"
          },
          "committer": {
            "email": "fjrevoredo@gmail.com",
            "name": "Francisco J. Revoredo",
            "username": "fjrevoredo"
          },
          "distinct": true,
          "id": "1baf65b8051a036a9ed1eb7784c69675162e9aae",
          "message": "flatpak fixes",
          "timestamp": "2026-03-31T04:17:17+02:00",
          "tree_id": "8cb27fcd1a32298cdb6e06b34720fb5cbfceb66b",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/1baf65b8051a036a9ed1eb7784c69675162e9aae"
        },
        "date": 1774923910624,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 94655977,
            "range": "± 157495",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 94682834,
            "range": "± 1290071",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 2104,
            "range": "± 34",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 14059,
            "range": "± 43",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 168497,
            "range": "± 411",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1608,
            "range": "± 2",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 13393,
            "range": "± 18",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 132156,
            "range": "± 168",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 1087335,
            "range": "± 211657",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 840783,
            "range": "± 50302",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 14170,
            "range": "± 131",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 33209,
            "range": "± 238",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 128083,
            "range": "± 3568",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 149518,
            "range": "± 1310",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 688338,
            "range": "± 3534",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 8961,
            "range": "± 163",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 11480,
            "range": "± 37",
            "unit": "ns/iter"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "fjrevoredo@gmail.com",
            "name": "Francisco J. Revoredo",
            "username": "fjrevoredo"
          },
          "committer": {
            "email": "fjrevoredo@gmail.com",
            "name": "Francisco J. Revoredo",
            "username": "fjrevoredo"
          },
          "distinct": true,
          "id": "4749a614f65108e83847547d16b7707bdd264348",
          "message": "e2e test fix",
          "timestamp": "2026-03-31T05:23:03+02:00",
          "tree_id": "a33f25790f5a7f2afa36748c02dc1282128b8c25",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/4749a614f65108e83847547d16b7707bdd264348"
        },
        "date": 1774927806652,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 104583029,
            "range": "± 1288716",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 102785064,
            "range": "± 924801",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 1799,
            "range": "± 5",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 12753,
            "range": "± 22",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 125907,
            "range": "± 195",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1467,
            "range": "± 19",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 12436,
            "range": "± 15",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 122954,
            "range": "± 245",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 790895,
            "range": "± 75357",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 579203,
            "range": "± 30709",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 9508,
            "range": "± 27",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 28659,
            "range": "± 95",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 120391,
            "range": "± 5689",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 124086,
            "range": "± 303",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 580482,
            "range": "± 964",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 6690,
            "range": "± 48",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 9588,
            "range": "± 34",
            "unit": "ns/iter"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "39350477+fjrevoredo@users.noreply.github.com",
            "name": "Francisco J. Revoredo",
            "username": "fjrevoredo"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "ba327ff103fef37740c74d679048e8320e260f50",
          "message": "dependency update (#82)\n\n## Summary\n\nBrief description of what this PR does and why.\n\n## Changes\n\n- Change 1\n- Change 2\n\n## Testing\n\n- [ ] `bun run lint` passes\n- [ ] `bun run format:check` passes\n- [ ] `bun run type-check` passes\n- [ ] `bun run test:run` passes\n- [ ] `cargo test` passes (in src-tauri/)\n- [ ] `cargo clippy --all-targets -- -D warnings` passes\n- [ ] Manual testing done\n\n## Related Issues\n\nCloses #",
          "timestamp": "2026-03-31T15:35:57+02:00",
          "tree_id": "2eb8ed55bb15fdb35ff8abb8c32cae75870ca4fa",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/ba327ff103fef37740c74d679048e8320e260f50"
        },
        "date": 1774964655181,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 102596007,
            "range": "± 540255",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 102319730,
            "range": "± 405096",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 1884,
            "range": "± 4",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 10620,
            "range": "± 18",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 98495,
            "range": "± 234",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1218,
            "range": "± 9",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 9657,
            "range": "± 176",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 95308,
            "range": "± 216",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 866762,
            "range": "± 73898",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 706557,
            "range": "± 55704",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 14839,
            "range": "± 56",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 32713,
            "range": "± 311",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 120899,
            "range": "± 675",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 141875,
            "range": "± 1032",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 652043,
            "range": "± 6286",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 8744,
            "range": "± 27",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 11932,
            "range": "± 56",
            "unit": "ns/iter"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "39350477+fjrevoredo@users.noreply.github.com",
            "name": "Francisco J. Revoredo",
            "username": "fjrevoredo"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "9ef479f3d86eb307efeeca74c9375c1b1fdfdc97",
          "message": "0.4.15",
          "timestamp": "2026-04-04T04:46:20+02:00",
          "tree_id": "b340c0cbea1bbfc0150cf6adeee1aac40892c463",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/9ef479f3d86eb307efeeca74c9375c1b1fdfdc97"
        },
        "date": 1775271200774,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 96804644,
            "range": "± 610668",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 96695550,
            "range": "± 316575",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 1879,
            "range": "± 19",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 10467,
            "range": "± 190",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 98500,
            "range": "± 282",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1250,
            "range": "± 3",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 9657,
            "range": "± 45",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 95406,
            "range": "± 671",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 826968,
            "range": "± 65647",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 640284,
            "range": "± 20919",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 14847,
            "range": "± 143",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 34483,
            "range": "± 355",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 126444,
            "range": "± 3022",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 146686,
            "range": "± 1953",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 674655,
            "range": "± 7262",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 9492,
            "range": "± 372",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 12041,
            "range": "± 52",
            "unit": "ns/iter"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "41898282+github-actions[bot]@users.noreply.github.com",
            "name": "github-actions[bot]",
            "username": "github-actions[bot]"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "69531f23fb761473a8302ed004a3d9f6a62aee3a",
          "message": "chore(release): clear latest changelog after v0.4.15\n\nAutomated cleanup PR created after publishing v0.4.15. Removes\nlatest-changelog.md so the next release must create a fresh copy from\nlatest-changelog.example.md.\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-04-04T05:36:44+02:00",
          "tree_id": "f6534d04c87421c7fe6567db478a029381c38488",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/69531f23fb761473a8302ed004a3d9f6a62aee3a"
        },
        "date": 1775274230983,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 90636772,
            "range": "± 1027755",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 92090853,
            "range": "± 922455",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 1640,
            "range": "± 88",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 10112,
            "range": "± 133",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 127409,
            "range": "± 301",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1190,
            "range": "± 9",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 9410,
            "range": "± 111",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 92287,
            "range": "± 277",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 1032032,
            "range": "± 113379",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 830279,
            "range": "± 28437",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 14136,
            "range": "± 141",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 32157,
            "range": "± 244",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 126773,
            "range": "± 7279",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 138619,
            "range": "± 786",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 633959,
            "range": "± 2760",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 9008,
            "range": "± 40",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 11527,
            "range": "± 29",
            "unit": "ns/iter"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "fjrevoredo@gmail.com",
            "name": "Francisco J. Revoredo",
            "username": "fjrevoredo"
          },
          "committer": {
            "email": "fjrevoredo@gmail.com",
            "name": "Francisco J. Revoredo",
            "username": "fjrevoredo"
          },
          "distinct": true,
          "id": "95190064069c37d1d641d5e11b0581a28bcfba0e",
          "message": "flatpak fixes",
          "timestamp": "2026-04-04T18:25:45+02:00",
          "tree_id": "6fb8ea9bdc94d78e6abe3b4b8b808b96b03e56d3",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/95190064069c37d1d641d5e11b0581a28bcfba0e"
        },
        "date": 1775320374731,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 103005345,
            "range": "± 374998",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 104042303,
            "range": "± 890957",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 1708,
            "range": "± 6",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 10124,
            "range": "± 31",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 127569,
            "range": "± 471",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1196,
            "range": "± 10",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 9417,
            "range": "± 118",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 92458,
            "range": "± 197",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 1081150,
            "range": "± 557869",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 905373,
            "range": "± 47924",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 14255,
            "range": "± 139",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 33533,
            "range": "± 237",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 127939,
            "range": "± 1054",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 139581,
            "range": "± 1365",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 635237,
            "range": "± 3483",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 8952,
            "range": "± 88",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 11494,
            "range": "± 104",
            "unit": "ns/iter"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "fjrevoredo@gmail.com",
            "name": "Francisco J. Revoredo",
            "username": "fjrevoredo"
          },
          "committer": {
            "email": "fjrevoredo@gmail.com",
            "name": "Francisco J. Revoredo",
            "username": "fjrevoredo"
          },
          "distinct": true,
          "id": "8458984db013d295bedc3925c1ffd20a5041b0f4",
          "message": "more flatpak fixes",
          "timestamp": "2026-04-04T19:11:48+02:00",
          "tree_id": "a9488e31bf89c72e738a0cf51af78209685d36da",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/8458984db013d295bedc3925c1ffd20a5041b0f4"
        },
        "date": 1775323125161,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 97554899,
            "range": "± 1149692",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 96337391,
            "range": "± 1123142",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 1705,
            "range": "± 39",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 10105,
            "range": "± 89",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 127437,
            "range": "± 183",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1166,
            "range": "± 3",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 9416,
            "range": "± 101",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 92242,
            "range": "± 95",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 1030940,
            "range": "± 970593",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 888005,
            "range": "± 73588",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 14021,
            "range": "± 46",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 31504,
            "range": "± 258",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 126772,
            "range": "± 1099",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 139247,
            "range": "± 781",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 637162,
            "range": "± 2610",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 6789,
            "range": "± 22",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 9845,
            "range": "± 155",
            "unit": "ns/iter"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "fjrevoredo@gmail.com",
            "name": "Francisco J. Revoredo",
            "username": "fjrevoredo"
          },
          "committer": {
            "email": "fjrevoredo@gmail.com",
            "name": "Francisco J. Revoredo",
            "username": "fjrevoredo"
          },
          "distinct": true,
          "id": "2938ad5a2872b005ded4c98e0287e780ddfbe1d0",
          "message": "fix tauri app category",
          "timestamp": "2026-04-04T19:33:04+02:00",
          "tree_id": "75f115572ffb9ffbdeb14338dc12466aada3c4f5",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/2938ad5a2872b005ded4c98e0287e780ddfbe1d0"
        },
        "date": 1775324409037,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 95723491,
            "range": "± 288083",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 95068852,
            "range": "± 848027",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 1714,
            "range": "± 7",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 10121,
            "range": "± 67",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 127676,
            "range": "± 690",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1189,
            "range": "± 27",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 9424,
            "range": "± 96",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 92585,
            "range": "± 377",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 1031090,
            "range": "± 105083",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 878230,
            "range": "± 55501",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 14200,
            "range": "± 70",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 34019,
            "range": "± 98",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 123210,
            "range": "± 787",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 139255,
            "range": "± 1216",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 638546,
            "range": "± 5255",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 6801,
            "range": "± 22",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 9826,
            "range": "± 47",
            "unit": "ns/iter"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "fjrevoredo@gmail.com",
            "name": "Francisco J. Revoredo",
            "username": "fjrevoredo"
          },
          "committer": {
            "email": "fjrevoredo@gmail.com",
            "name": "Francisco J. Revoredo",
            "username": "fjrevoredo"
          },
          "distinct": true,
          "id": "09b1c7b3566f454c1d39a2e463776e09126e6fc9",
          "message": "Update website. Add new blog post",
          "timestamp": "2026-04-05T19:08:40+02:00",
          "tree_id": "a73ab7f2f8ec0785a6969ce4e1acc83ab14afec3",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/09b1c7b3566f454c1d39a2e463776e09126e6fc9"
        },
        "date": 1775409341241,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 98652147,
            "range": "± 945982",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 98617457,
            "range": "± 1016441",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 1709,
            "range": "± 9",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 10114,
            "range": "± 21",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 127894,
            "range": "± 8060",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1175,
            "range": "± 14",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 9429,
            "range": "± 49",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 93006,
            "range": "± 283",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 1371355,
            "range": "± 333522",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 1370637,
            "range": "± 173238",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 14468,
            "range": "± 411",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 33728,
            "range": "± 1317",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 113604,
            "range": "± 412",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 139600,
            "range": "± 645",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 637158,
            "range": "± 8151",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 6813,
            "range": "± 16",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 9834,
            "range": "± 141",
            "unit": "ns/iter"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "39350477+fjrevoredo@users.noreply.github.com",
            "name": "Francisco J. Revoredo",
            "username": "fjrevoredo"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "9f11663b5f324df354b00318512e8d2f3992639b",
          "message": "fixes for flatpak",
          "timestamp": "2026-04-06T20:59:31+02:00",
          "tree_id": "acccf2d2f5ef44129713b26f4358cfae2bdbed91",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/9f11663b5f324df354b00318512e8d2f3992639b"
        },
        "date": 1775502410133,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 96890525,
            "range": "± 858175",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 98550003,
            "range": "± 1542459",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 1711,
            "range": "± 11",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 10120,
            "range": "± 24",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 127752,
            "range": "± 642",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1176,
            "range": "± 2",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 9410,
            "range": "± 16",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 92261,
            "range": "± 128",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 1414597,
            "range": "± 434025",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 1137362,
            "range": "± 196797",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 13861,
            "range": "± 58",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 33521,
            "range": "± 193",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 112585,
            "range": "± 1054",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 137284,
            "range": "± 651",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 631516,
            "range": "± 2648",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 7950,
            "range": "± 212",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 9823,
            "range": "± 54",
            "unit": "ns/iter"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "fjrevoredo@gmail.com",
            "name": "Francisco J. Revoredo",
            "username": "fjrevoredo"
          },
          "committer": {
            "email": "fjrevoredo@gmail.com",
            "name": "Francisco J. Revoredo",
            "username": "fjrevoredo"
          },
          "distinct": true,
          "id": "fb17d77a28ef7e3f82071ee8a51013079d220916",
          "message": "optimized website",
          "timestamp": "2026-04-09T00:44:59+02:00",
          "tree_id": "62f5b324a2c2f74f280c6dec4f2f78320d277635",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/fb17d77a28ef7e3f82071ee8a51013079d220916"
        },
        "date": 1775688720885,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 100582602,
            "range": "± 481835",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 99493236,
            "range": "± 1532357",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 1710,
            "range": "± 8",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 10123,
            "range": "± 24",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 127425,
            "range": "± 372",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1178,
            "range": "± 4",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 9428,
            "range": "± 18",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 92329,
            "range": "± 131",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 1061931,
            "range": "± 259431",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 867964,
            "range": "± 54514",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 14145,
            "range": "± 65",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 34022,
            "range": "± 216",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 113617,
            "range": "± 400",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 138988,
            "range": "± 621",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 637088,
            "range": "± 5102",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 6811,
            "range": "± 25",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 9817,
            "range": "± 252",
            "unit": "ns/iter"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "fjrevoredo@gmail.com",
            "name": "Francisco J. Revoredo",
            "username": "fjrevoredo"
          },
          "committer": {
            "email": "fjrevoredo@gmail.com",
            "name": "Francisco J. Revoredo",
            "username": "fjrevoredo"
          },
          "distinct": true,
          "id": "73ac1df9fd523277001396c404a74fa7cc32e262",
          "message": "dependency updates",
          "timestamp": "2026-04-13T22:43:13+02:00",
          "tree_id": "f473dfcc5b23b24cf468ca0c68d8b3fd2a6b1e2d",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/73ac1df9fd523277001396c404a74fa7cc32e262"
        },
        "date": 1776113526210,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 95375083,
            "range": "± 368827",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 96612741,
            "range": "± 966458",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 2114,
            "range": "± 11",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 14178,
            "range": "± 21",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 171263,
            "range": "± 267",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1594,
            "range": "± 3",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 13490,
            "range": "± 18",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 132948,
            "range": "± 239",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 1189906,
            "range": "± 214953",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 1087191,
            "range": "± 111770",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 14440,
            "range": "± 64",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 35193,
            "range": "± 94",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 129767,
            "range": "± 590",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 144644,
            "range": "± 1442",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 663244,
            "range": "± 7881",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 8955,
            "range": "± 77",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 11514,
            "range": "± 36",
            "unit": "ns/iter"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "39350477+fjrevoredo@users.noreply.github.com",
            "name": "Francisco J. Revoredo",
            "username": "fjrevoredo"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "a2ade2da0689a1ca5fcd1c228bcc88ca89562602",
          "message": "v0.4.16",
          "timestamp": "2026-04-17T00:49:16+02:00",
          "tree_id": "2f50f5308335f03a0f107529e026deae93df5ce1",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/a2ade2da0689a1ca5fcd1c228bcc88ca89562602"
        },
        "date": 1776380405858,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 93464269,
            "range": "± 1089175",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 95142146,
            "range": "± 548518",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 2090,
            "range": "± 57",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 14077,
            "range": "± 13",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 166785,
            "range": "± 286",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1574,
            "range": "± 2",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 13426,
            "range": "± 15",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 132867,
            "range": "± 395",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 1365407,
            "range": "± 396311",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 1086500,
            "range": "± 120885",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 14223,
            "range": "± 92",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 33015,
            "range": "± 192",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 122822,
            "range": "± 762",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 142640,
            "range": "± 2383",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 654763,
            "range": "± 3516",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 6795,
            "range": "± 11",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 9844,
            "range": "± 74",
            "unit": "ns/iter"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "fjrevoredo@gmail.com",
            "name": "Francisco J. Revoredo",
            "username": "fjrevoredo"
          },
          "committer": {
            "email": "fjrevoredo@gmail.com",
            "name": "Francisco J. Revoredo",
            "username": "fjrevoredo"
          },
          "distinct": true,
          "id": "f85de2a540ae216a183dd10c25ce0a87082e33cc",
          "message": "Fix for flatpak packaging",
          "timestamp": "2026-04-17T08:31:45+02:00",
          "tree_id": "ed2c83ee37180c1539f39052cc28784dfccfbbd4",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/f85de2a540ae216a183dd10c25ce0a87082e33cc"
        },
        "date": 1776407934731,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 95180888,
            "range": "± 688511",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 94884623,
            "range": "± 3302068",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 2099,
            "range": "± 57",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 14056,
            "range": "± 50",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 167611,
            "range": "± 268",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1596,
            "range": "± 67",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 13399,
            "range": "± 373",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 132416,
            "range": "± 306",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 1160900,
            "range": "± 405832",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 1076267,
            "range": "± 87139",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 14302,
            "range": "± 53",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 31151,
            "range": "± 126",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 121667,
            "range": "± 440",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 142493,
            "range": "± 777",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 651765,
            "range": "± 1714",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 6800,
            "range": "± 14",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 9828,
            "range": "± 228",
            "unit": "ns/iter"
          }
        ]
      }
    ]
  }
}