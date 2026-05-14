window.BENCHMARK_DATA = {
  "lastUpdate": 1778719208493,
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
          "id": "126723c9bb2f2d249689ed3224207f608ae8a6ac",
          "message": "update docs",
          "timestamp": "2026-04-17T08:58:07+02:00",
          "tree_id": "45ca30159fe9237313c19c4ba1d1aab1ace4e766",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/126723c9bb2f2d249689ed3224207f608ae8a6ac"
        },
        "date": 1776409539635,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 94163560,
            "range": "± 584163",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 92588582,
            "range": "± 1812702",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 2086,
            "range": "± 9",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 14063,
            "range": "± 45",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 168875,
            "range": "± 876",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1573,
            "range": "± 3",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 13405,
            "range": "± 111",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 132598,
            "range": "± 638",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 1011095,
            "range": "± 244275",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 813210,
            "range": "± 101010",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 14149,
            "range": "± 84",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 30601,
            "range": "± 419",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 122042,
            "range": "± 1690",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 144319,
            "range": "± 619",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 665923,
            "range": "± 3546",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 6807,
            "range": "± 1565",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 9813,
            "range": "± 38",
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
          "id": "d00cabe2c071e48f046bf36d5afbc2c6699ea4b7",
          "message": "further cleanup for flatpak",
          "timestamp": "2026-04-18T13:04:32+02:00",
          "tree_id": "ce020081ddf247c2f0bb367d7c7ad1ab8e1da0c9",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/d00cabe2c071e48f046bf36d5afbc2c6699ea4b7"
        },
        "date": 1776510701840,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 110176873,
            "range": "± 821103",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 110722465,
            "range": "± 689619",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 1793,
            "range": "± 3",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 12841,
            "range": "± 48",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 126523,
            "range": "± 260",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1447,
            "range": "± 2",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 12428,
            "range": "± 18",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 124388,
            "range": "± 367",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 1018599,
            "range": "± 249181",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 788152,
            "range": "± 84545",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 9378,
            "range": "± 108",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 29456,
            "range": "± 118",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 120312,
            "range": "± 2860",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 122859,
            "range": "± 462",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 575156,
            "range": "± 2105",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 5946,
            "range": "± 154",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 8304,
            "range": "± 85",
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
          "id": "694c9c2e882ac78a5942defedc08dcd34b77aa0b",
          "message": "fix flatpak release flow",
          "timestamp": "2026-04-18T15:01:48+02:00",
          "tree_id": "44b21acf18ef5d60023cd98377e5bae8c72ad275",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/694c9c2e882ac78a5942defedc08dcd34b77aa0b"
        },
        "date": 1776517776220,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 125831379,
            "range": "± 1033176",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 123893711,
            "range": "± 1270511",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 1791,
            "range": "± 39",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 12807,
            "range": "± 139",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 126852,
            "range": "± 291",
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
            "value": 12472,
            "range": "± 59",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 124950,
            "range": "± 497",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 1192161,
            "range": "± 366559",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 893012,
            "range": "± 87245",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 9620,
            "range": "± 53",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 30435,
            "range": "± 268",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 122461,
            "range": "± 4129",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 122902,
            "range": "± 731",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 575244,
            "range": "± 5061",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 6112,
            "range": "± 96",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 8459,
            "range": "± 75",
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
          "id": "608e7bf9cc4a5fc059e41bd934bfb8288bf23b2b",
          "message": "more fixes for flatpak",
          "timestamp": "2026-04-18T19:45:18+02:00",
          "tree_id": "6092a8f1185a5e16aa7525db94589f96b75fbda6",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/608e7bf9cc4a5fc059e41bd934bfb8288bf23b2b"
        },
        "date": 1776534774435,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 94372246,
            "range": "± 585874",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 96560459,
            "range": "± 713151",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 2101,
            "range": "± 33",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 14092,
            "range": "± 22",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 167140,
            "range": "± 1468",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1573,
            "range": "± 4",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 13399,
            "range": "± 200",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 132680,
            "range": "± 179",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 1106711,
            "range": "± 229635",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 923503,
            "range": "± 93822",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 14230,
            "range": "± 76",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 32467,
            "range": "± 150",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 122655,
            "range": "± 526",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 142145,
            "range": "± 941",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 649162,
            "range": "± 5358",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 6817,
            "range": "± 20",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 9830,
            "range": "± 26",
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
          "id": "fb8a0075a26fbf65978237c6778a461983a1248b",
          "message": "Add italian translation (#96)\n\nCo-authored-by: albanobattistella <34811668+albanobattistella@users.noreply.github.com>",
          "timestamp": "2026-04-19T00:45:25+02:00",
          "tree_id": "1a13ac6c500f6a002a965f2d893d20b19a7aa309",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/fb8a0075a26fbf65978237c6778a461983a1248b"
        },
        "date": 1776552764510,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 90722664,
            "range": "± 307301",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 90853076,
            "range": "± 1102550",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 2100,
            "range": "± 5",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 14085,
            "range": "± 36",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 168502,
            "range": "± 457",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1594,
            "range": "± 6",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 13380,
            "range": "± 29",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 132296,
            "range": "± 2685",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 1161401,
            "range": "± 311875",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 897750,
            "range": "± 48721",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 14047,
            "range": "± 163",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 33417,
            "range": "± 578",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 125911,
            "range": "± 568",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 142172,
            "range": "± 1350",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 655846,
            "range": "± 3489",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 7592,
            "range": "± 162",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 10771,
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
          "id": "d20b18db8c8d45a5e28fca89cd9aefcc3a3c2071",
          "message": "v0.4.17",
          "timestamp": "2026-04-19T19:47:50+02:00",
          "tree_id": "cd80271bf4ad663f8f0d968ee4b41da39287462b",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/d20b18db8c8d45a5e28fca89cd9aefcc3a3c2071"
        },
        "date": 1776621329286,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 77952431,
            "range": "± 1372362",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 77863575,
            "range": "± 2087937",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 1796,
            "range": "± 86",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 11462,
            "range": "± 56",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 111584,
            "range": "± 477",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1313,
            "range": "± 3",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 10829,
            "range": "± 11",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 107224,
            "range": "± 1134",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 1182270,
            "range": "± 33278471",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 1188462,
            "range": "± 3302156",
            "unit": "ns/iter"
          },
          {
            "name": "db_delete_entry",
            "value": 1007163,
            "range": "± 30431139",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 11521,
            "range": "± 181",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 25634,
            "range": "± 255",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 96249,
            "range": "± 363",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 114998,
            "range": "± 1599",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 532053,
            "range": "± 6176",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 5625,
            "range": "± 96",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 7853,
            "range": "± 336",
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
          "id": "f2177252e7fb881a9ffa15fd487df585e99212f6",
          "message": "fix benchmarks",
          "timestamp": "2026-04-19T20:22:32+02:00",
          "tree_id": "ab513453ed8a7bca8f7aa10f109834cb81b95e8b",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/f2177252e7fb881a9ffa15fd487df585e99212f6"
        },
        "date": 1776623398349,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 90611671,
            "range": "± 1007094",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 90308265,
            "range": "± 166706",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 2097,
            "range": "± 4",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 14052,
            "range": "± 15",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 168576,
            "range": "± 229",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1597,
            "range": "± 3",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 13383,
            "range": "± 12",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 132313,
            "range": "± 292",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 1047438,
            "range": "± 105855",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 831439,
            "range": "± 30491",
            "unit": "ns/iter"
          },
          {
            "name": "db_delete_entry",
            "value": 929950,
            "range": "± 90455",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 14100,
            "range": "± 230",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 32264,
            "range": "± 1126",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 125893,
            "range": "± 869",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 143263,
            "range": "± 1263",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 661310,
            "range": "± 6723",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 6939,
            "range": "± 123",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 9908,
            "range": "± 89",
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
          "id": "482d99a44ae46a0898cc174b200199a5cdb6b8d3",
          "message": "fix benchmark reference name",
          "timestamp": "2026-04-19T22:10:37+02:00",
          "tree_id": "cec8424f431fbcc10ac7fb799ac1384ada6e630a",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/482d99a44ae46a0898cc174b200199a5cdb6b8d3"
        },
        "date": 1776629898245,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 77665986,
            "range": "± 583922",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 77865391,
            "range": "± 1329253",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 1794,
            "range": "± 5",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 11425,
            "range": "± 11",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 109954,
            "range": "± 86",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1314,
            "range": "± 2",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 10813,
            "range": "± 374",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 107210,
            "range": "± 1948",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 1123742,
            "range": "± 31175449",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 1184774,
            "range": "± 3879487",
            "unit": "ns/iter"
          },
          {
            "name": "db_delete_entry",
            "value": 1023006,
            "range": "± 9882579",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 11586,
            "range": "± 265",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 26441,
            "range": "± 280",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 95234,
            "range": "± 294",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 114699,
            "range": "± 1642",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 528139,
            "range": "± 1495",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 5724,
            "range": "± 34",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 8427,
            "range": "± 313",
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
          "id": "849c9dea79890dc7a368bf041721f5a8b4b5d262",
          "message": "chore(release): clear latest changelog after v0.4.17 (#98)\n\nAutomated cleanup PR created after publishing v0.4.17. Removes\nlatest-changelog.md so the next release must create a fresh copy from\nlatest-changelog.example.md.\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-04-19T22:11:00+02:00",
          "tree_id": "1c276d306d623b9dccb6dc00cd3015b3be9562ff",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/849c9dea79890dc7a368bf041721f5a8b4b5d262"
        },
        "date": 1776630365544,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 91735610,
            "range": "± 775867",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 91496355,
            "range": "± 636829",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 2091,
            "range": "± 3",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 14085,
            "range": "± 112",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 168150,
            "range": "± 279",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1572,
            "range": "± 9",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 13413,
            "range": "± 21",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 132297,
            "range": "± 195",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 1156687,
            "range": "± 250083",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 973971,
            "range": "± 100161",
            "unit": "ns/iter"
          },
          {
            "name": "db_delete_entry",
            "value": 1041682,
            "range": "± 240566",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 13591,
            "range": "± 124",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 33140,
            "range": "± 301",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 125605,
            "range": "± 448",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 142955,
            "range": "± 1314",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 653052,
            "range": "± 5835",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 6931,
            "range": "± 247",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 9960,
            "range": "± 328",
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
          "id": "e313c141ef3e6c77f19ad70b8ba69d8d069ae5d3",
          "message": "release script fixes",
          "timestamp": "2026-04-19T22:19:17+02:00",
          "tree_id": "80b141eca783fdbd027db2efb9c8dd72ad8a06e8",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/e313c141ef3e6c77f19ad70b8ba69d8d069ae5d3"
        },
        "date": 1776630813819,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 92252241,
            "range": "± 87245",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 92239625,
            "range": "± 134827",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 2277,
            "range": "± 91",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 14592,
            "range": "± 72",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 140459,
            "range": "± 276",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1673,
            "range": "± 4",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 13767,
            "range": "± 27",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 136424,
            "range": "± 152",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 872842,
            "range": "± 612315",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 635823,
            "range": "± 26650",
            "unit": "ns/iter"
          },
          {
            "name": "db_delete_entry",
            "value": 756993,
            "range": "± 147083",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 14814,
            "range": "± 54",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 33191,
            "range": "± 189",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 114373,
            "range": "± 635",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 146358,
            "range": "± 655",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 675153,
            "range": "± 5466",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 7272,
            "range": "± 172",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 10038,
            "range": "± 594",
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
          "id": "1829e39e5835f9681c3b11518298b8a33e411a92",
          "message": "Mini 0.4.18 release",
          "timestamp": "2026-04-19T23:07:41+02:00",
          "tree_id": "edd71074d2474312bec604ed1bd135d996b01dc6",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/1829e39e5835f9681c3b11518298b8a33e411a92"
        },
        "date": 1776633314022,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 90330130,
            "range": "± 222626",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 90806530,
            "range": "± 786325",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 2091,
            "range": "± 3",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 14084,
            "range": "± 13",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 167189,
            "range": "± 210",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1599,
            "range": "± 6",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 13396,
            "range": "± 21",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 132312,
            "range": "± 114",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 1121793,
            "range": "± 754169",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 1011135,
            "range": "± 65208",
            "unit": "ns/iter"
          },
          {
            "name": "db_delete_entry",
            "value": 1003903,
            "range": "± 112525",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 13834,
            "range": "± 108",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 31995,
            "range": "± 146",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 126040,
            "range": "± 584",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 142788,
            "range": "± 4253",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 660211,
            "range": "± 8440",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 6938,
            "range": "± 152",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 9825,
            "range": "± 85",
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
          "id": "9892f01484c6aa62e2d8893e6456a31d6334cd20",
          "message": "chore(release): clear latest changelog after v0.4.18 (#99)\n\nAutomated cleanup PR created after publishing v0.4.18. Removes\nlatest-changelog.md so the next release must create a fresh copy from\nlatest-changelog.example.md.\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-04-19T23:55:34+02:00",
          "tree_id": "d6eac688e328b9f4f05aba79df4aea1ead5452a7",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/9892f01484c6aa62e2d8893e6456a31d6334cd20"
        },
        "date": 1776636178988,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 90197651,
            "range": "± 193639",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 90808052,
            "range": "± 200714",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 2089,
            "range": "± 36",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 14085,
            "range": "± 59",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 168523,
            "range": "± 247",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1597,
            "range": "± 12",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 13410,
            "range": "± 43",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 132313,
            "range": "± 116",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 1067107,
            "range": "± 300162",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 979965,
            "range": "± 91597",
            "unit": "ns/iter"
          },
          {
            "name": "db_delete_entry",
            "value": 951972,
            "range": "± 332050",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 14122,
            "range": "± 213",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 33213,
            "range": "± 185",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 126768,
            "range": "± 4195",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 144665,
            "range": "± 1677",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 666928,
            "range": "± 7554",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 6946,
            "range": "± 368",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 9855,
            "range": "± 80",
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
          "id": "89bd47d41005a18a0e7acb7d230af9005f2f8049",
          "message": "winget publish stale fork fix",
          "timestamp": "2026-04-19T23:59:07+02:00",
          "tree_id": "fec6db626d0249a89d10ace440fbd5b3928e7b73",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/89bd47d41005a18a0e7acb7d230af9005f2f8049"
        },
        "date": 1776636637571,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 94486399,
            "range": "± 1056093",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 94507993,
            "range": "± 773555",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 2094,
            "range": "± 42",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 14040,
            "range": "± 48",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 169046,
            "range": "± 732",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1596,
            "range": "± 5",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 13388,
            "range": "± 36",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 132958,
            "range": "± 398",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 1116016,
            "range": "± 1109962",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 899026,
            "range": "± 102161",
            "unit": "ns/iter"
          },
          {
            "name": "db_delete_entry",
            "value": 996651,
            "range": "± 185686",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 14113,
            "range": "± 68",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 33340,
            "range": "± 196",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 126972,
            "range": "± 585",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 144445,
            "range": "± 1021",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 665527,
            "range": "± 3500",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 6957,
            "range": "± 54",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 9836,
            "range": "± 76",
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
          "id": "cfe230e64bb14aba0a3553070ebc86dce44620e0",
          "message": "dependency updates",
          "timestamp": "2026-04-21T05:23:09+02:00",
          "tree_id": "ee8758a958c8da86e8896861db20543b51c91f87",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/cfe230e64bb14aba0a3553070ebc86dce44620e0"
        },
        "date": 1776742265906,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 90324333,
            "range": "± 274691",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 91349791,
            "range": "± 342502",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 2100,
            "range": "± 7",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 14080,
            "range": "± 31",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 168718,
            "range": "± 796",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1594,
            "range": "± 10",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 13390,
            "range": "± 126",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 132742,
            "range": "± 314",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 1075931,
            "range": "± 363638",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 887645,
            "range": "± 55180",
            "unit": "ns/iter"
          },
          {
            "name": "db_delete_entry",
            "value": 944173,
            "range": "± 123040",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 14071,
            "range": "± 62",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 33353,
            "range": "± 898",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 128223,
            "range": "± 650",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 143084,
            "range": "± 347",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 657217,
            "range": "± 2010",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 6944,
            "range": "± 54",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 9928,
            "range": "± 65",
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
          "id": "a344d08334d0f24494ce6b872107c26c4c4fe82e",
          "message": "dependency updates",
          "timestamp": "2026-04-21T05:34:57+02:00",
          "tree_id": "0e0b40141d3cf3c7acc7f698fe8c127284d08c3e",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/a344d08334d0f24494ce6b872107c26c4c4fe82e"
        },
        "date": 1776742943816,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 99757443,
            "range": "± 309432",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 99406917,
            "range": "± 488317",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 2299,
            "range": "± 20",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 14581,
            "range": "± 22",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 139456,
            "range": "± 972",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1644,
            "range": "± 3",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 13765,
            "range": "± 29",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 136392,
            "range": "± 406",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 950935,
            "range": "± 205824",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 737423,
            "range": "± 66260",
            "unit": "ns/iter"
          },
          {
            "name": "db_delete_entry",
            "value": 774534,
            "range": "± 105164",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 14813,
            "range": "± 92",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 35206,
            "range": "± 248",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 128176,
            "range": "± 534",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 148978,
            "range": "± 518",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 688546,
            "range": "± 3478",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 7256,
            "range": "± 128",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 10013,
            "range": "± 60",
            "unit": "ns/iter"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "49699333+dependabot[bot]@users.noreply.github.com",
            "name": "dependabot[bot]",
            "username": "dependabot[bot]"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "7fc2431def03145e97d93021a4c529c7032d65fb",
          "message": "Bump the dev-dependencies group across 1 directory with 4 updates (#103)\n\nBumps the dev-dependencies group with 1 update in the / directory:\n[eslint](https://github.com/eslint/eslint).\n\nUpdates `eslint` from 10.2.0 to 10.2.1\n<details>\n<summary>Release notes</summary>\n<p><em>Sourced from <a\nhref=\"https://github.com/eslint/eslint/releases\">eslint's\nreleases</a>.</em></p>\n<blockquote>\n<h2>v10.2.1</h2>\n<h2>Bug Fixes</h2>\n<ul>\n<li><a\nhref=\"https://github.com/eslint/eslint/commit/14be92b6d1fa0923b8923830f2208e5e2705b002\"><code>14be92b</code></a>\nfix: model generator yield resumption paths in code path analysis (<a\nhref=\"https://redirect.github.com/eslint/eslint/issues/20665\">#20665</a>)\n(sethamus)</li>\n<li><a\nhref=\"https://github.com/eslint/eslint/commit/84a19d2c32255db6b9cfc08644a607aae6d5cb62\"><code>84a19d2</code></a>\nfix: no-async-promise-executor false positives for shadowed Promise (<a\nhref=\"https://redirect.github.com/eslint/eslint/issues/20740\">#20740</a>)\n(xbinaryx)</li>\n<li><a\nhref=\"https://github.com/eslint/eslint/commit/af764af0ec38225755fbf8a6f207f0c77b595a8d\"><code>af764af</code></a>\nfix: clarify language and processor validation errors (<a\nhref=\"https://redirect.github.com/eslint/eslint/issues/20729\">#20729</a>)\n(Pixel998)</li>\n<li><a\nhref=\"https://github.com/eslint/eslint/commit/e251b89a38280973e468a4a9386c138f4f55d10d\"><code>e251b89</code></a>\nfix: update eslint (<a\nhref=\"https://redirect.github.com/eslint/eslint/issues/20715\">#20715</a>)\n(renovate[bot])</li>\n</ul>\n<h2>Documentation</h2>\n<ul>\n<li><a\nhref=\"https://github.com/eslint/eslint/commit/ca92ca0fb4599e8de1e2fb914e695fe7397cbe63\"><code>ca92ca0</code></a>\ndocs: reuse markdown-it instance for markdown filter (<a\nhref=\"https://redirect.github.com/eslint/eslint/issues/20768\">#20768</a>)\n(Amaresh S M)</li>\n<li><a\nhref=\"https://github.com/eslint/eslint/commit/57d2ee213305cee0cb55ef08e0480b57396269a9\"><code>57d2ee2</code></a>\ndocs: Enable Eleventy incremental mode for watch (<a\nhref=\"https://redirect.github.com/eslint/eslint/issues/20767\">#20767</a>)\n(Amaresh S M)</li>\n<li><a\nhref=\"https://github.com/eslint/eslint/commit/c1621b915742276e5f4b25efe790ca62296330dc\"><code>c1621b9</code></a>\ndocs: fix typos in code-path-analyzer.js (<a\nhref=\"https://redirect.github.com/eslint/eslint/issues/20700\">#20700</a>)\n(Ayush Shukla)</li>\n<li><a\nhref=\"https://github.com/eslint/eslint/commit/1418d522d10bde1960f4942afb548bc7160ec49e\"><code>1418d52</code></a>\ndocs: Update README (GitHub Actions Bot)</li>\n<li><a\nhref=\"https://github.com/eslint/eslint/commit/39771e6e600f0b0617fdeafff6dd07e4211ffde6\"><code>39771e6</code></a>\ndocs: Update README (GitHub Actions Bot)</li>\n<li><a\nhref=\"https://github.com/eslint/eslint/commit/71e04693def2df57268f08f3072a2749df6bf438\"><code>71e0469</code></a>\ndocs: fix incomplete JSDoc param description in no-shadow rule (<a\nhref=\"https://redirect.github.com/eslint/eslint/issues/20728\">#20728</a>)\n(kuldeep kumar)</li>\n<li><a\nhref=\"https://github.com/eslint/eslint/commit/22119ceb93e28f62262fc1d98ff1b1442d6e2dbf\"><code>22119ce</code></a>\ndocs: clarify scope of for-direction rule with dead code examples (<a\nhref=\"https://redirect.github.com/eslint/eslint/issues/20723\">#20723</a>)\n(Amaresh S M)</li>\n<li><a\nhref=\"https://github.com/eslint/eslint/commit/8f3fb77f122a5641d1833cad5d93f3f54fa3be0b\"><code>8f3fb77</code></a>\ndocs: document <code>meta.docs.dialects</code> (<a\nhref=\"https://redirect.github.com/eslint/eslint/issues/20718\">#20718</a>)\n(Pixel998)</li>\n</ul>\n<h2>Chores</h2>\n<ul>\n<li><a\nhref=\"https://github.com/eslint/eslint/commit/7ddfea9c4f62add1588c5c0b0da568c299246383\"><code>7ddfea9</code></a>\nchore: update dependency prettier to v3.8.2 (<a\nhref=\"https://redirect.github.com/eslint/eslint/issues/20770\">#20770</a>)\n(renovate[bot])</li>\n<li><a\nhref=\"https://github.com/eslint/eslint/commit/fac40e1de2ba7646cc7cd2d3f93fbdd1f8819001\"><code>fac40e1</code></a>\nci: bump pnpm/action-setup from 5.0.0 to 6.0.0 (<a\nhref=\"https://redirect.github.com/eslint/eslint/issues/20763\">#20763</a>)\n(dependabot[bot])</li>\n<li><a\nhref=\"https://github.com/eslint/eslint/commit/7246f923332522d8b3d46b6ee646fce88535f3fb\"><code>7246f92</code></a>\ntest: add tests for SuppressionsService.load() error handling (<a\nhref=\"https://redirect.github.com/eslint/eslint/issues/20734\">#20734</a>)\n(kuldeep kumar)</li>\n<li><a\nhref=\"https://github.com/eslint/eslint/commit/4f34b1e592b0f63d766d9903998e8e36eb49d3aa\"><code>4f34b1e</code></a>\nchore: update pnpm/action-setup action to v5 (<a\nhref=\"https://redirect.github.com/eslint/eslint/issues/20762\">#20762</a>)\n(renovate[bot])</li>\n<li><a\nhref=\"https://github.com/eslint/eslint/commit/51080eb5c98d619434e4835dbe9f1c6654aca3b8\"><code>51080eb</code></a>\ntest: processor service (<a\nhref=\"https://redirect.github.com/eslint/eslint/issues/20731\">#20731</a>)\n(kuldeep kumar)</li>\n<li><a\nhref=\"https://github.com/eslint/eslint/commit/e7e1889fca9b6044e08f41b38df20a1ce45808c8\"><code>e7e1889</code></a>\nchore: remove stale babel-eslint10 fixture and test (<a\nhref=\"https://redirect.github.com/eslint/eslint/issues/20727\">#20727</a>)\n(kuldeep kumar)</li>\n<li><a\nhref=\"https://github.com/eslint/eslint/commit/4e1a87cb8fb90e309524bc36bc5f31b9f9cfaa76\"><code>4e1a87c</code></a>\ntest: remove redundant async/await in flat config array tests (<a\nhref=\"https://redirect.github.com/eslint/eslint/issues/20722\">#20722</a>)\n(Pixel998)</li>\n<li><a\nhref=\"https://github.com/eslint/eslint/commit/066eabb3643b12931f991594969bcc0028f71a5f\"><code>066eabb</code></a>\ntest: add rule metadata coverage for <code>languages</code> and\n<code>docs.dialects</code> (<a\nhref=\"https://redirect.github.com/eslint/eslint/issues/20717\">#20717</a>)\n(Pixel998)</li>\n</ul>\n</blockquote>\n</details>\n<details>\n<summary>Commits</summary>\n<ul>\n<li><a\nhref=\"https://github.com/eslint/eslint/commit/4d1d8f9737236603f64bbe83d5bb8001627b5611\"><code>4d1d8f9</code></a>\n10.2.1</li>\n<li><a\nhref=\"https://github.com/eslint/eslint/commit/3e33105b05d09b5a4eb894ed75a9811fb40d65e6\"><code>3e33105</code></a>\nBuild: changelog update for 10.2.1</li>\n<li><a\nhref=\"https://github.com/eslint/eslint/commit/ca92ca0fb4599e8de1e2fb914e695fe7397cbe63\"><code>ca92ca0</code></a>\ndocs: reuse markdown-it instance for markdown filter (<a\nhref=\"https://redirect.github.com/eslint/eslint/issues/20768\">#20768</a>)</li>\n<li><a\nhref=\"https://github.com/eslint/eslint/commit/7ddfea9c4f62add1588c5c0b0da568c299246383\"><code>7ddfea9</code></a>\nchore: update dependency prettier to v3.8.2 (<a\nhref=\"https://redirect.github.com/eslint/eslint/issues/20770\">#20770</a>)</li>\n<li><a\nhref=\"https://github.com/eslint/eslint/commit/57d2ee213305cee0cb55ef08e0480b57396269a9\"><code>57d2ee2</code></a>\ndocs: Enable Eleventy incremental mode for watch (<a\nhref=\"https://redirect.github.com/eslint/eslint/issues/20767\">#20767</a>)</li>\n<li><a\nhref=\"https://github.com/eslint/eslint/commit/c1621b915742276e5f4b25efe790ca62296330dc\"><code>c1621b9</code></a>\ndocs: fix typos in code-path-analyzer.js (<a\nhref=\"https://redirect.github.com/eslint/eslint/issues/20700\">#20700</a>)</li>\n<li><a\nhref=\"https://github.com/eslint/eslint/commit/fac40e1de2ba7646cc7cd2d3f93fbdd1f8819001\"><code>fac40e1</code></a>\nci: bump pnpm/action-setup from 5.0.0 to 6.0.0 (<a\nhref=\"https://redirect.github.com/eslint/eslint/issues/20763\">#20763</a>)</li>\n<li><a\nhref=\"https://github.com/eslint/eslint/commit/7246f923332522d8b3d46b6ee646fce88535f3fb\"><code>7246f92</code></a>\ntest: add tests for SuppressionsService.load() error handling (<a\nhref=\"https://redirect.github.com/eslint/eslint/issues/20734\">#20734</a>)</li>\n<li><a\nhref=\"https://github.com/eslint/eslint/commit/4f34b1e592b0f63d766d9903998e8e36eb49d3aa\"><code>4f34b1e</code></a>\nchore: update pnpm/action-setup action to v5 (<a\nhref=\"https://redirect.github.com/eslint/eslint/issues/20762\">#20762</a>)</li>\n<li><a\nhref=\"https://github.com/eslint/eslint/commit/1418d522d10bde1960f4942afb548bc7160ec49e\"><code>1418d52</code></a>\ndocs: Update README</li>\n<li>Additional commits viewable in <a\nhref=\"https://github.com/eslint/eslint/compare/v10.2.0...v10.2.1\">compare\nview</a></li>\n</ul>\n</details>\n<br />\n\nUpdates `typescript` from 6.0.2 to 6.0.3\n<details>\n<summary>Release notes</summary>\n<p><em>Sourced from <a\nhref=\"https://github.com/microsoft/TypeScript/releases\">typescript's\nreleases</a>.</em></p>\n<blockquote>\n<h2>TypeScript 6.0.3</h2>\n<p>For release notes, check out the <a\nhref=\"https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/\">release\nannouncement blog post</a>.</p>\n<ul>\n<li><a\nhref=\"https://github.com/Microsoft/TypeScript/issues?utf8=%E2%9C%93&amp;q=milestone%3A%22TypeScript+6.0.0%22\">fixed\nissues query for TypeScript 6.0.0 (Beta)</a>.</li>\n<li><a\nhref=\"https://github.com/Microsoft/TypeScript/issues?utf8=%E2%9C%93&amp;q=milestone%3A%22TypeScript+6.0.1%22\">fixed\nissues query for TypeScript 6.0.1 (RC)</a>.</li>\n<li><a\nhref=\"https://github.com/Microsoft/TypeScript/issues?utf8=%E2%9C%93&amp;q=milestone%3A%22TypeScript+6.0.2%22\">fixed\nissues query for TypeScript 6.0.2 (Stable)</a>.</li>\n<li><a\nhref=\"https://github.com/Microsoft/TypeScript/issues?utf8=%E2%9C%93&amp;q=milestone%3A%22TypeScript+6.0.3%22\">fixed\nissues query for TypeScript 6.0.3 (Stable)</a>.</li>\n</ul>\n<p>Downloads are available on:</p>\n<ul>\n<li><a href=\"https://www.npmjs.com/package/typescript\">npm</a></li>\n</ul>\n</blockquote>\n</details>\n<details>\n<summary>Commits</summary>\n<ul>\n<li><a\nhref=\"https://github.com/microsoft/TypeScript/commit/050880ce59e30b356b686bd3144efe24f875ebc8\"><code>050880c</code></a>\nBump version to 6.0.3 and LKG</li>\n<li><a\nhref=\"https://github.com/microsoft/TypeScript/commit/eeae9dd0f17aa494658e4ec079dc002e02dd625e\"><code>eeae9dd</code></a>\n🤖 Pick PR <a\nhref=\"https://redirect.github.com/microsoft/TypeScript/issues/63401\">#63401</a>\n(Also check package name validity in...) into release-6.0 (#...</li>\n<li><a\nhref=\"https://github.com/microsoft/TypeScript/commit/ad1c695fada682764bb510dd680e8f175ae54094\"><code>ad1c695</code></a>\n🤖 Pick PR <a\nhref=\"https://redirect.github.com/microsoft/TypeScript/issues/63368\">#63368</a>\n(Harden ATA package name filtering) into release-6.0 (<a\nhref=\"https://redirect.github.com/microsoft/TypeScript/issues/63372\">#63372</a>)</li>\n<li><a\nhref=\"https://github.com/microsoft/TypeScript/commit/0725fb4664a1d5ec94040b6d94db77dc1cc354e4\"><code>0725fb4</code></a>\n🤖 Pick PR <a\nhref=\"https://redirect.github.com/microsoft/TypeScript/issues/63310\">#63310</a>\n(Mark class property initializers as...) into release-6.0 (#...</li>\n<li>See full diff in <a\nhref=\"https://github.com/microsoft/TypeScript/compare/v6.0.2...v6.0.3\">compare\nview</a></li>\n</ul>\n</details>\n<br />\n\nUpdates `typescript-eslint` from 8.58.2 to 8.59.0\n<details>\n<summary>Release notes</summary>\n<p><em>Sourced from <a\nhref=\"https://github.com/typescript-eslint/typescript-eslint/releases\">typescript-eslint's\nreleases</a>.</em></p>\n<blockquote>\n<h2>v8.59.0</h2>\n<h2>8.59.0 (2026-04-20)</h2>\n<h3>🚀 Features</h3>\n<ul>\n<li><strong>eslint-plugin:</strong> [no-unnecessary-type-assertion]\nreport more cases based on assignability (<a\nhref=\"https://redirect.github.com/typescript-eslint/typescript-eslint/pull/11789\">#11789</a>)</li>\n</ul>\n<h3>❤️ Thank You</h3>\n<ul>\n<li>Ulrich Stark</li>\n</ul>\n<p>See <a\nhref=\"https://github.com/typescript-eslint/typescript-eslint/releases/tag/v8.59.0\">GitHub\nReleases</a> for more information.</p>\n<p>You can read about our <a\nhref=\"https://typescript-eslint.io/users/versioning\">versioning\nstrategy</a> and <a\nhref=\"https://typescript-eslint.io/users/releases\">releases</a> on our\nwebsite.</p>\n</blockquote>\n</details>\n<details>\n<summary>Changelog</summary>\n<p><em>Sourced from <a\nhref=\"https://github.com/typescript-eslint/typescript-eslint/blob/main/packages/typescript-eslint/CHANGELOG.md\">typescript-eslint's\nchangelog</a>.</em></p>\n<blockquote>\n<h2>8.59.0 (2026-04-20)</h2>\n<p>This was a version bump only for typescript-eslint to align it with\nother projects, there were no code changes.</p>\n<p>See <a\nhref=\"https://github.com/typescript-eslint/typescript-eslint/releases/tag/v8.59.0\">GitHub\nReleases</a> for more information.</p>\n<p>You can read about our <a\nhref=\"https://typescript-eslint.io/users/versioning\">versioning\nstrategy</a> and <a\nhref=\"https://typescript-eslint.io/users/releases\">releases</a> on our\nwebsite.</p>\n</blockquote>\n</details>\n<details>\n<summary>Commits</summary>\n<ul>\n<li><a\nhref=\"https://github.com/typescript-eslint/typescript-eslint/commit/ea9ae4f8817873480e3501145059f63e39e8d8a1\"><code>ea9ae4f</code></a>\nchore(release): publish 8.59.0</li>\n<li>See full diff in <a\nhref=\"https://github.com/typescript-eslint/typescript-eslint/commits/v8.59.0/packages/typescript-eslint\">compare\nview</a></li>\n</ul>\n</details>\n<br />\n\nUpdates `vite` from 8.0.8 to 8.0.9\n<details>\n<summary>Release notes</summary>\n<p><em>Sourced from <a\nhref=\"https://github.com/vitejs/vite/releases\">vite's\nreleases</a>.</em></p>\n<blockquote>\n<h2>v8.0.9</h2>\n<p>Please refer to <a\nhref=\"https://github.com/vitejs/vite/blob/v8.0.9/packages/vite/CHANGELOG.md\">CHANGELOG.md</a>\nfor details.</p>\n</blockquote>\n</details>\n<details>\n<summary>Changelog</summary>\n<p><em>Sourced from <a\nhref=\"https://github.com/vitejs/vite/blob/main/packages/vite/CHANGELOG.md\">vite's\nchangelog</a>.</em></p>\n<blockquote>\n<h2><!-- raw HTML omitted --><a\nhref=\"https://github.com/vitejs/vite/compare/v8.0.8...v8.0.9\">8.0.9</a>\n(2026-04-20)<!-- raw HTML omitted --></h2>\n<h3>Features</h3>\n<ul>\n<li>update rolldown to 1.0.0-rc.16 (<a\nhref=\"https://redirect.github.com/vitejs/vite/issues/22248\">#22248</a>)\n(<a\nhref=\"https://github.com/vitejs/vite/commit/2947edd57ceb64a0b4dc43269743e8e44e68c09b\">2947edd</a>)</li>\n</ul>\n<h3>Bug Fixes</h3>\n<ul>\n<li>allow binding when strictPort is set but wildcard port is in use (<a\nhref=\"https://redirect.github.com/vitejs/vite/issues/22150\">#22150</a>)\n(<a\nhref=\"https://github.com/vitejs/vite/commit/dfc8aa5057dd8ec2b1223980d1e2eeb946ac3384\">dfc8aa5</a>)</li>\n<li><strong>build:</strong> emptyOutDir should happen for watch rebuilds\n(<a\nhref=\"https://redirect.github.com/vitejs/vite/issues/22207\">#22207</a>)\n(<a\nhref=\"https://github.com/vitejs/vite/commit/ee522672bb374c7ff95a347f14732491121b1cd6\">ee52267</a>)</li>\n<li><strong>bundled-dev:</strong> reject requests to HMR patch files in\nnon potentially trustworthy origins (<a\nhref=\"https://redirect.github.com/vitejs/vite/issues/22269\">#22269</a>)\n(<a\nhref=\"https://github.com/vitejs/vite/commit/868f1411a6f474baa4417f2d6524692dd452f760\">868f141</a>)</li>\n<li><strong>css:</strong> use unique key for cssEntriesMap to prevent\nsame-basename collision (<a\nhref=\"https://redirect.github.com/vitejs/vite/issues/22039\">#22039</a>)\n(<a\nhref=\"https://github.com/vitejs/vite/commit/374bb5d597fcd0485e929565c698d8ed219136f8\">374bb5d</a>)</li>\n<li><strong>deps:</strong> update all non-major dependencies (<a\nhref=\"https://redirect.github.com/vitejs/vite/issues/22219\">#22219</a>)\n(<a\nhref=\"https://github.com/vitejs/vite/commit/4cd0d6760edd5fb0841abe86538de3c225e880a1\">4cd0d67</a>)</li>\n<li><strong>deps:</strong> update all non-major dependencies (<a\nhref=\"https://redirect.github.com/vitejs/vite/issues/22268\">#22268</a>)\n(<a\nhref=\"https://github.com/vitejs/vite/commit/c28e9c12a849f80e6fdc93f42283ad2863ab9dbc\">c28e9c1</a>)</li>\n<li>detect Deno workspace root (fix <a\nhref=\"https://redirect.github.com/vitejs/vite/issues/22237\">#22237</a>)\n(<a\nhref=\"https://redirect.github.com/vitejs/vite/issues/22238\">#22238</a>)\n(<a\nhref=\"https://github.com/vitejs/vite/commit/1b793c0e1726467fffd06ffad9bc81c61a840188\">1b793c0</a>)</li>\n<li><strong>dev:</strong> handle errors in <code>watchChange</code> hook\n(<a\nhref=\"https://redirect.github.com/vitejs/vite/issues/22188\">#22188</a>)\n(<a\nhref=\"https://github.com/vitejs/vite/commit/fc08bdab9bba871b03689f2f6997c3a4ba4351da\">fc08bda</a>)</li>\n<li><strong>optimizer:</strong> handle more chars that will be sanitized\n(<a\nhref=\"https://redirect.github.com/vitejs/vite/issues/22208\">#22208</a>)\n(<a\nhref=\"https://github.com/vitejs/vite/commit/3f24533ac4845ed22547279d1721bd82a35345e3\">3f24533</a>)</li>\n<li>skip fallback sourcemap generation for <code>?raw</code> imports (<a\nhref=\"https://redirect.github.com/vitejs/vite/issues/22148\">#22148</a>)\n(<a\nhref=\"https://github.com/vitejs/vite/commit/3ec9cdaac7936ca32d0956c4cb1eb6e172945996\">3ec9cda</a>)</li>\n</ul>\n<h3>Documentation</h3>\n<ul>\n<li>align the descriptions in READMEs (<a\nhref=\"https://redirect.github.com/vitejs/vite/issues/22231\">#22231</a>)\n(<a\nhref=\"https://github.com/vitejs/vite/commit/44c42b97639bb6ad777e66d752b2829cccb9a27a\">44c42b9</a>)</li>\n<li>fix reuses wording in dev environment comment (<a\nhref=\"https://redirect.github.com/vitejs/vite/issues/22173\">#22173</a>)\n(<a\nhref=\"https://github.com/vitejs/vite/commit/9163412fdfec7fb1656529713326a5b5c5e986ea\">9163412</a>)</li>\n<li>fix wording in sass error comment (<a\nhref=\"https://redirect.github.com/vitejs/vite/issues/22214\">#22214</a>)\n(<a\nhref=\"https://github.com/vitejs/vite/commit/bc5c6a7a498845dff20dc410c395355b79a4b753\">bc5c6a7</a>)</li>\n<li>update build CLI defaults (<a\nhref=\"https://redirect.github.com/vitejs/vite/issues/22261\">#22261</a>)\n(<a\nhref=\"https://github.com/vitejs/vite/commit/605bb97994678a1bb70a8de9a85c29d5f5d48c5a\">605bb97</a>)</li>\n</ul>\n<h3>Miscellaneous Chores</h3>\n<ul>\n<li><strong>deps:</strong> update dependency dotenv-expand to v13 (<a\nhref=\"https://redirect.github.com/vitejs/vite/issues/22271\">#22271</a>)\n(<a\nhref=\"https://github.com/vitejs/vite/commit/0a3887da18812cacb254c616e4dd35631e776fda\">0a3887d</a>)</li>\n</ul>\n</blockquote>\n</details>\n<details>\n<summary>Commits</summary>\n<ul>\n<li><a\nhref=\"https://github.com/vitejs/vite/commit/ce729f5fa1a5adca373b2adcb0e1b18099164a14\"><code>ce729f5</code></a>\nrelease: v8.0.9</li>\n<li><a\nhref=\"https://github.com/vitejs/vite/commit/605bb97994678a1bb70a8de9a85c29d5f5d48c5a\"><code>605bb97</code></a>\ndocs: update build CLI defaults (<a\nhref=\"https://github.com/vitejs/vite/tree/HEAD/packages/vite/issues/22261\">#22261</a>)</li>\n<li><a\nhref=\"https://github.com/vitejs/vite/commit/c28e9c12a849f80e6fdc93f42283ad2863ab9dbc\"><code>c28e9c1</code></a>\nfix(deps): update all non-major dependencies (<a\nhref=\"https://github.com/vitejs/vite/tree/HEAD/packages/vite/issues/22268\">#22268</a>)</li>\n<li><a\nhref=\"https://github.com/vitejs/vite/commit/0a3887da18812cacb254c616e4dd35631e776fda\"><code>0a3887d</code></a>\nchore(deps): update dependency dotenv-expand to v13 (<a\nhref=\"https://github.com/vitejs/vite/tree/HEAD/packages/vite/issues/22271\">#22271</a>)</li>\n<li><a\nhref=\"https://github.com/vitejs/vite/commit/868f1411a6f474baa4417f2d6524692dd452f760\"><code>868f141</code></a>\nfix(bundled-dev): reject requests to HMR patch files in non potentially\ntrust...</li>\n<li><a\nhref=\"https://github.com/vitejs/vite/commit/3ec9cdaac7936ca32d0956c4cb1eb6e172945996\"><code>3ec9cda</code></a>\nfix: skip fallback sourcemap generation for <code>?raw</code> imports\n(<a\nhref=\"https://github.com/vitejs/vite/tree/HEAD/packages/vite/issues/22148\">#22148</a>)</li>\n<li><a\nhref=\"https://github.com/vitejs/vite/commit/3f24533ac4845ed22547279d1721bd82a35345e3\"><code>3f24533</code></a>\nfix(optimizer): handle more chars that will be sanitized (<a\nhref=\"https://github.com/vitejs/vite/tree/HEAD/packages/vite/issues/22208\">#22208</a>)</li>\n<li><a\nhref=\"https://github.com/vitejs/vite/commit/1b793c0e1726467fffd06ffad9bc81c61a840188\"><code>1b793c0</code></a>\nfix: detect Deno workspace root (fix <a\nhref=\"https://github.com/vitejs/vite/tree/HEAD/packages/vite/issues/22237\">#22237</a>)\n(<a\nhref=\"https://github.com/vitejs/vite/tree/HEAD/packages/vite/issues/22238\">#22238</a>)</li>\n<li><a\nhref=\"https://github.com/vitejs/vite/commit/fc08bdab9bba871b03689f2f6997c3a4ba4351da\"><code>fc08bda</code></a>\nfix(dev): handle errors in <code>watchChange</code> hook (<a\nhref=\"https://github.com/vitejs/vite/tree/HEAD/packages/vite/issues/22188\">#22188</a>)</li>\n<li><a\nhref=\"https://github.com/vitejs/vite/commit/374bb5d597fcd0485e929565c698d8ed219136f8\"><code>374bb5d</code></a>\nfix(css): use unique key for cssEntriesMap to prevent same-basename\ncollision...</li>\n<li>Additional commits viewable in <a\nhref=\"https://github.com/vitejs/vite/commits/v8.0.9/packages/vite\">compare\nview</a></li>\n</ul>\n</details>\n<br />\n\nSigned-off-by: dependabot[bot] <support@github.com>\nCo-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>",
          "timestamp": "2026-04-21T06:01:59+02:00",
          "tree_id": "a2ee5d78cee150312b8f411063ed7c00e4866d0a",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/7fc2431def03145e97d93021a4c529c7032d65fb"
        },
        "date": 1776744554148,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 91639436,
            "range": "± 654066",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 91242508,
            "range": "± 306256",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 2119,
            "range": "± 5",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 14079,
            "range": "± 16",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 169430,
            "range": "± 265",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1599,
            "range": "± 2",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 13402,
            "range": "± 14",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 132301,
            "range": "± 159",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 1562485,
            "range": "± 655714",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 1309213,
            "range": "± 181960",
            "unit": "ns/iter"
          },
          {
            "name": "db_delete_entry",
            "value": 1387682,
            "range": "± 364359",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 14070,
            "range": "± 160",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 34331,
            "range": "± 231",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 125282,
            "range": "± 419",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 142776,
            "range": "± 1502",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 656594,
            "range": "± 6952",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 6956,
            "range": "± 51",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 9820,
            "range": "± 146",
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
          "id": "c58a0370a6f4eed22ee129431fa41a079b64ebad",
          "message": "German locale regression fix",
          "timestamp": "2026-04-21T07:18:41+02:00",
          "tree_id": "b58ac7cb2cfc28b76104208230d5ef2df399a7c7",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/c58a0370a6f4eed22ee129431fa41a079b64ebad"
        },
        "date": 1776749176415,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 91509996,
            "range": "± 577742",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 92183470,
            "range": "± 574238",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 2090,
            "range": "± 5",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 14104,
            "range": "± 46",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 167272,
            "range": "± 224",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1573,
            "range": "± 2",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 13395,
            "range": "± 25",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 132392,
            "range": "± 485",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 1062676,
            "range": "± 149556",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 910304,
            "range": "± 58750",
            "unit": "ns/iter"
          },
          {
            "name": "db_delete_entry",
            "value": 1013481,
            "range": "± 451911",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 14508,
            "range": "± 157",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 33476,
            "range": "± 115",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 126800,
            "range": "± 1023",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 141211,
            "range": "± 712",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 646419,
            "range": "± 57479",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 6943,
            "range": "± 210",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 9928,
            "range": "± 88",
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
          "id": "12050276100ea5456c8dd7e44b2c84a04207c71b",
          "message": "v0.4.19",
          "timestamp": "2026-04-27T10:48:16+02:00",
          "tree_id": "fa26de54625bcd691f88541f9f09df577b06dd3a",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/12050276100ea5456c8dd7e44b2c84a04207c71b"
        },
        "date": 1777280150143,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 109797382,
            "range": "± 472769",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 108651608,
            "range": "± 1507835",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 1787,
            "range": "± 5",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 12809,
            "range": "± 17",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 126321,
            "range": "± 230",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1451,
            "range": "± 2",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 12400,
            "range": "± 19",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 123904,
            "range": "± 228",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 761199,
            "range": "± 126587",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 613300,
            "range": "± 41303",
            "unit": "ns/iter"
          },
          {
            "name": "db_delete_entry",
            "value": 681451,
            "range": "± 62169",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 9578,
            "range": "± 33",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 30617,
            "range": "± 412",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 121146,
            "range": "± 314",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 121967,
            "range": "± 630",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 570414,
            "range": "± 6719",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 6695,
            "range": "± 64",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 9617,
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
          "id": "99d18b35bd6ac9e54d2fd5f20a8c5879f47ff424",
          "message": "add notification",
          "timestamp": "2026-04-27T10:58:08+02:00",
          "tree_id": "79afd013835e1831ff251efde4715473456fd9c4",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/99d18b35bd6ac9e54d2fd5f20a8c5879f47ff424"
        },
        "date": 1777280724704,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 93550308,
            "range": "± 466032",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 93861336,
            "range": "± 886437",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 2096,
            "range": "± 3",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 14144,
            "range": "± 17",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 170087,
            "range": "± 502",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1577,
            "range": "± 14",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 13453,
            "range": "± 32",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 133319,
            "range": "± 529",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 991355,
            "range": "± 63516",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 804637,
            "range": "± 32518",
            "unit": "ns/iter"
          },
          {
            "name": "db_delete_entry",
            "value": 907358,
            "range": "± 100213",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 14030,
            "range": "± 91",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 33321,
            "range": "± 320",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 127835,
            "range": "± 759",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 142819,
            "range": "± 580",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 650042,
            "range": "± 2774",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 8837,
            "range": "± 47",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 11494,
            "range": "± 48",
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
          "id": "de3c990f971b0a671ea1c2c262c0ca5b1c2a37e1",
          "message": "chore(release): clear latest changelog after v0.4.19 (#106)\n\nAutomated cleanup PR created after publishing v0.4.19. Removes\nlatest-changelog.md so the next release must create a fresh copy from\nlatest-changelog.example.md.\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-04-27T11:43:56+02:00",
          "tree_id": "d500b6abf918c9375e7df9a059c84d60959b633b",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/de3c990f971b0a671ea1c2c262c0ca5b1c2a37e1"
        },
        "date": 1777283498669,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 93922238,
            "range": "± 489882",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 94244267,
            "range": "± 292776",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 2283,
            "range": "± 53",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 14561,
            "range": "± 355",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 139689,
            "range": "± 754",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1675,
            "range": "± 5",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 13810,
            "range": "± 37",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 136661,
            "range": "± 426",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 877314,
            "range": "± 367245",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 647563,
            "range": "± 79811",
            "unit": "ns/iter"
          },
          {
            "name": "db_delete_entry",
            "value": 784310,
            "range": "± 91047",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 14928,
            "range": "± 74",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 32646,
            "range": "± 113",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 117460,
            "range": "± 2481",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 148163,
            "range": "± 4182",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 680862,
            "range": "± 10607",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 8747,
            "range": "± 40",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 11896,
            "range": "± 712",
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
          "id": "79321005110c72eb0246f209e38546590c10b319",
          "message": "fix for flathub",
          "timestamp": "2026-04-27T13:05:51+02:00",
          "tree_id": "61bd5e57a0167b0e359b3b5e1649b7c0240373fe",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/79321005110c72eb0246f209e38546590c10b319"
        },
        "date": 1777288415313,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 91497524,
            "range": "± 687278",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 91467774,
            "range": "± 855394",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 2094,
            "range": "± 4",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 14110,
            "range": "± 77",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 169631,
            "range": "± 543",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1599,
            "range": "± 3",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 13448,
            "range": "± 28",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 132838,
            "range": "± 148",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 1059223,
            "range": "± 343845",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 861426,
            "range": "± 70701",
            "unit": "ns/iter"
          },
          {
            "name": "db_delete_entry",
            "value": 947436,
            "range": "± 86789",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 14115,
            "range": "± 63",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 34665,
            "range": "± 179",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 130188,
            "range": "± 619",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 142970,
            "range": "± 460",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 649896,
            "range": "± 13772",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 8823,
            "range": "± 316",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 11486,
            "range": "± 42",
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
          "id": "1a392408d6d493188e85f37ec311d11a57daec49",
          "message": "update dependencies",
          "timestamp": "2026-04-28T18:45:45+02:00",
          "tree_id": "237f800eb32651e7998ae43879dd27ff198d33f4",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/1a392408d6d493188e85f37ec311d11a57daec49"
        },
        "date": 1777395251932,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 92256338,
            "range": "± 860129",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 92755373,
            "range": "± 408386",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 2088,
            "range": "± 3",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 14159,
            "range": "± 21",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 168579,
            "range": "± 182",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1578,
            "range": "± 4",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 13472,
            "range": "± 55",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 133034,
            "range": "± 278",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 1017239,
            "range": "± 231656",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 855825,
            "range": "± 36390",
            "unit": "ns/iter"
          },
          {
            "name": "db_delete_entry",
            "value": 968633,
            "range": "± 331544",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 13908,
            "range": "± 58",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 33681,
            "range": "± 294",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 125715,
            "range": "± 1555",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 141477,
            "range": "± 905",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 651305,
            "range": "± 5284",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 7608,
            "range": "± 137",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 10733,
            "range": "± 66",
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
          "id": "0e92f57ef7c7336711194fa720dcdbdfe03ab1c0",
          "message": "update dependencies",
          "timestamp": "2026-04-28T19:21:10+02:00",
          "tree_id": "8f2968da888d17b75897e25931b0829d376fd679",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/0e92f57ef7c7336711194fa720dcdbdfe03ab1c0"
        },
        "date": 1777397356087,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 76861834,
            "range": "± 2400385",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 76975640,
            "range": "± 235020",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 1792,
            "range": "± 5",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 11430,
            "range": "± 84",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 109587,
            "range": "± 1202",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1327,
            "range": "± 3",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 10839,
            "range": "± 12",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 107351,
            "range": "± 2145",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 1184675,
            "range": "± 18909802",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 1767033,
            "range": "± 5276220",
            "unit": "ns/iter"
          },
          {
            "name": "db_delete_entry",
            "value": 1035828,
            "range": "± 41594469",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 11514,
            "range": "± 33",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 26155,
            "range": "± 224",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 97815,
            "range": "± 2029",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 114673,
            "range": "± 938",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 528962,
            "range": "± 2018",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 6299,
            "range": "± 96",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 8658,
            "range": "± 182",
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
          "id": "44c3f522c1f7c1d7633fa6f8e07be431a6bbfaed",
          "message": "overhaul benchmarks",
          "timestamp": "2026-04-28T21:29:46+02:00",
          "tree_id": "7fad691618bfca78dc83cb6d1376c835ac99cf93",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/44c3f522c1f7c1d7633fa6f8e07be431a6bbfaed"
        },
        "date": 1777405058458,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 92295233,
            "range": "± 423419",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 92097480,
            "range": "± 972270",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 2086,
            "range": "± 4",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 14115,
            "range": "± 157",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 168966,
            "range": "± 11687",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1603,
            "range": "± 2",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 13440,
            "range": "± 15",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 133351,
            "range": "± 199",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 993628,
            "range": "± 104956",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 870315,
            "range": "± 93945",
            "unit": "ns/iter"
          },
          {
            "name": "db_delete_entry",
            "value": 928687,
            "range": "± 131138",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 13990,
            "range": "± 58",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 32878,
            "range": "± 116",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 123636,
            "range": "± 1901",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 141587,
            "range": "± 1744",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 652007,
            "range": "± 6000",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 7599,
            "range": "± 16",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 10716,
            "range": "± 40",
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
          "id": "1c54fb3086ad39247714503398c155b4743ae9ed",
          "message": "fix benchmark colors",
          "timestamp": "2026-04-28T21:50:05+02:00",
          "tree_id": "213f9d0969cb590cbc135a393426c2cfaeacd9aa",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/1c54fb3086ad39247714503398c155b4743ae9ed"
        },
        "date": 1777406285963,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 95613808,
            "range": "± 800603",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 96168646,
            "range": "± 417646",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 2292,
            "range": "± 37",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 14617,
            "range": "± 235",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 139703,
            "range": "± 883",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1669,
            "range": "± 27",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 13811,
            "range": "± 25",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 136591,
            "range": "± 869",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 863059,
            "range": "± 251554",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 720862,
            "range": "± 78825",
            "unit": "ns/iter"
          },
          {
            "name": "db_delete_entry",
            "value": 795432,
            "range": "± 136118",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 14744,
            "range": "± 354",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 33468,
            "range": "± 290",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 123136,
            "range": "± 1642",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 146067,
            "range": "± 2336",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 676684,
            "range": "± 4122",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 8738,
            "range": "± 172",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 10987,
            "range": "± 150",
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
          "id": "bf3efe373c910a1eed0284dd6f88fd8546c1c9f7",
          "message": "v0.4.20",
          "timestamp": "2026-05-06T01:43:36+02:00",
          "tree_id": "5e481b1dc561cfe4b3487bbed42ce68bbde83545",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/bf3efe373c910a1eed0284dd6f88fd8546c1c9f7"
        },
        "date": 1778025570843,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 104134932,
            "range": "± 897614",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 103830182,
            "range": "± 627690",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 1792,
            "range": "± 4",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 12861,
            "range": "± 25",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 126791,
            "range": "± 234",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1455,
            "range": "± 1",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 12452,
            "range": "± 24",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 124322,
            "range": "± 290",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 1205413,
            "range": "± 270697",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 1000198,
            "range": "± 112573",
            "unit": "ns/iter"
          },
          {
            "name": "db_delete_entry",
            "value": 1057875,
            "range": "± 263402",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 9525,
            "range": "± 33",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 29451,
            "range": "± 121",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 118772,
            "range": "± 814",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 121902,
            "range": "± 243",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 567914,
            "range": "± 2727",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 5923,
            "range": "± 58",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 8566,
            "range": "± 171",
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
          "id": "475a7386cbdadc305d4fe7ac6dcb00814ae52fbc",
          "message": "dependency updates",
          "timestamp": "2026-05-06T08:00:42+02:00",
          "tree_id": "403fdad3205a0c1c45aee570e16571c5af272d4c",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/475a7386cbdadc305d4fe7ac6dcb00814ae52fbc"
        },
        "date": 1778047713623,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 91872670,
            "range": "± 1315833",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 92687407,
            "range": "± 787429",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 2110,
            "range": "± 29",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 14154,
            "range": "± 22",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 170546,
            "range": "± 238",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1578,
            "range": "± 3",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 13446,
            "range": "± 58",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 133103,
            "range": "± 278",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 1051281,
            "range": "± 243207",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 858605,
            "range": "± 38682",
            "unit": "ns/iter"
          },
          {
            "name": "db_delete_entry",
            "value": 935795,
            "range": "± 190070",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 14090,
            "range": "± 56",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 33700,
            "range": "± 175",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 123059,
            "range": "± 1602",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 140735,
            "range": "± 513",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 643789,
            "range": "± 1630",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 6941,
            "range": "± 62",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 9821,
            "range": "± 57",
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
          "id": "28400eb672626fc7e19875fcfa43475b8cfe1c76",
          "message": "add new skill",
          "timestamp": "2026-05-06T20:33:01+02:00",
          "tree_id": "b0eb60b8787dee2ebb7dae62d0f06b12f671f7ba",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/28400eb672626fc7e19875fcfa43475b8cfe1c76"
        },
        "date": 1778092864830,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 93003475,
            "range": "± 364140",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 93531404,
            "range": "± 2719168",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 2104,
            "range": "± 106",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 14143,
            "range": "± 108",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 168779,
            "range": "± 3595",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1578,
            "range": "± 16",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 13448,
            "range": "± 60",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 132942,
            "range": "± 227",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 1030740,
            "range": "± 504272",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 849914,
            "range": "± 58610",
            "unit": "ns/iter"
          },
          {
            "name": "db_delete_entry",
            "value": 952784,
            "range": "± 138738",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 14120,
            "range": "± 208",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 32080,
            "range": "± 699",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 119967,
            "range": "± 1549",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 141186,
            "range": "± 422",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 646225,
            "range": "± 24639",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 6935,
            "range": "± 68",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 9968,
            "range": "± 398",
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
          "id": "6854fb2b6cda5a00339d73d05d98133330df76a3",
          "message": "fix",
          "timestamp": "2026-05-06T21:05:10+02:00",
          "tree_id": "c9fe0df0815e7655e50741bc6bdb6fefd6e7dddb",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/6854fb2b6cda5a00339d73d05d98133330df76a3"
        },
        "date": 1778094937320,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 110916873,
            "range": "± 1349972",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 111699770,
            "range": "± 1809321",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 1791,
            "range": "± 14",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 12878,
            "range": "± 25",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 126868,
            "range": "± 1446",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1445,
            "range": "± 2",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 12436,
            "range": "± 20",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 124515,
            "range": "± 218",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 847098,
            "range": "± 174315",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 617908,
            "range": "± 50646",
            "unit": "ns/iter"
          },
          {
            "name": "db_delete_entry",
            "value": 711329,
            "range": "± 144088",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 9697,
            "range": "± 33",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 29268,
            "range": "± 183",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 119382,
            "range": "± 1007",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 122259,
            "range": "± 314",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 570548,
            "range": "± 2252",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 6041,
            "range": "± 19",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 8418,
            "range": "± 50",
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
          "id": "80ede211d7f989f3ecfc85f4bb2aff000df1e91f",
          "message": "chore(release): clear latest changelog after v0.4.20 (#117)\n\nAutomated cleanup PR created after publishing v0.4.20. Removes\nlatest-changelog.md so the next release must create a fresh copy from\nlatest-changelog.example.md.\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-05-06T21:05:30+02:00",
          "tree_id": "a0fd53cce68f6bf8ee7ce0dd90e0d98a3e49abe4",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/80ede211d7f989f3ecfc85f4bb2aff000df1e91f"
        },
        "date": 1778095392772,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 91179774,
            "range": "± 214626",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 91694383,
            "range": "± 440845",
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
            "value": 14143,
            "range": "± 21",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 168201,
            "range": "± 677",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1602,
            "range": "± 12",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 13445,
            "range": "± 30",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 133084,
            "range": "± 647",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 1281770,
            "range": "± 622575",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 1104795,
            "range": "± 147803",
            "unit": "ns/iter"
          },
          {
            "name": "db_delete_entry",
            "value": 1178907,
            "range": "± 509956",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 14161,
            "range": "± 328",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 32786,
            "range": "± 117",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 119271,
            "range": "± 658",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 141444,
            "range": "± 690",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 646630,
            "range": "± 2274",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 7029,
            "range": "± 811",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 9858,
            "range": "± 67",
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
          "id": "6aea07789c6f3c3ed8b6c295826a1d8a50dc5039",
          "message": "flathub fixes and documentation cleanup",
          "timestamp": "2026-05-07T01:05:52+02:00",
          "tree_id": "0b06259a398ed526d84dc333074b7e240b7ea2c0",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/6aea07789c6f3c3ed8b6c295826a1d8a50dc5039"
        },
        "date": 1778109294583,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 94215668,
            "range": "± 212646",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 94943692,
            "range": "± 307237",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 2094,
            "range": "± 14",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 14149,
            "range": "± 21",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 167928,
            "range": "± 602",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1601,
            "range": "± 10",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 13450,
            "range": "± 132",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 132897,
            "range": "± 152",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 1092980,
            "range": "± 123114",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 950601,
            "range": "± 53171",
            "unit": "ns/iter"
          },
          {
            "name": "db_delete_entry",
            "value": 949563,
            "range": "± 94029",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 14640,
            "range": "± 168",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 32957,
            "range": "± 129",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 124484,
            "range": "± 436",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 141795,
            "range": "± 1599",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 648870,
            "range": "± 4918",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 6949,
            "range": "± 66",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 9909,
            "range": "± 100",
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
          "id": "8f707eb169c1b839d507fb4cc3feec0bd9b9b9e7",
          "message": "flathub maintenance skill",
          "timestamp": "2026-05-07T14:07:38+02:00",
          "tree_id": "d69a730401889129ce7f02b6a6b7ed2d1649be3f",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/8f707eb169c1b839d507fb4cc3feec0bd9b9b9e7"
        },
        "date": 1778156166114,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 77278291,
            "range": "± 542374",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 77248432,
            "range": "± 1959698",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 1788,
            "range": "± 4",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 11468,
            "range": "± 50",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 110489,
            "range": "± 1021",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1313,
            "range": "± 3",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 10861,
            "range": "± 287",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 107227,
            "range": "± 1313",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 1155091,
            "range": "± 12578067",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 1056643,
            "range": "± 4656218",
            "unit": "ns/iter"
          },
          {
            "name": "db_delete_entry",
            "value": 996704,
            "range": "± 39446138",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 11575,
            "range": "± 65",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 25762,
            "range": "± 509",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 94944,
            "range": "± 783",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 115089,
            "range": "± 334",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 529567,
            "range": "± 2012",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 5630,
            "range": "± 32",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 8419,
            "range": "± 44",
            "unit": "ns/iter"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "49699333+dependabot[bot]@users.noreply.github.com",
            "name": "dependabot[bot]",
            "username": "dependabot[bot]"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "fb795b67b479791247cc14d467d2039f9970a2e9",
          "message": "Bump tauri from 2.11.0 to 2.11.1 in /src-tauri (#122)\n\nBumps [tauri](https://github.com/tauri-apps/tauri) from 2.11.0 to\n2.11.1.\n<details>\n<summary>Release notes</summary>\n<p><em>Sourced from <a\nhref=\"https://github.com/tauri-apps/tauri/releases\">tauri's\nreleases</a>.</em></p>\n<blockquote>\n<h2>tauri-cli v2.11.1</h2>\n<!-- raw HTML omitted -->\n<pre><code>Fetching advisory database from\n`https://github.com/RustSec/advisory-db.git`\nLoaded 1067 security advisories (from /home/runner/.cargo/advisory-db)\n    Updating crates.io index\n    Scanning Cargo.lock for vulnerabilities (1088 crate dependencies)\nCrate:     atk\nVersion:   0.18.2\nWarning:   unmaintained\nTitle:     gtk-rs GTK3 bindings - no longer maintained\nDate:      2024-03-04\nID:        RUSTSEC-2024-0413\nURL:       https://rustsec.org/advisories/RUSTSEC-2024-0413\nDependency tree:\natk 0.18.2\n└── gtk 0.18.2\n    ├── wry 0.55.0\n    │   └── tauri-runtime-wry 2.11.1\n    │       └── tauri 2.11.1\n    │           ├── tauri-utils 2.9.1\n    │           │   ├── tauri-schema-generator 0.0.0\n    │           │   ├── tauri-runtime-wry 2.11.1\n    │           │   ├── tauri-runtime 2.11.1\n    │           │   │   ├── tauri-runtime-wry 2.11.1\n    │           │   │   └── tauri 2.11.1\n    │           │   ├── tauri-plugin 2.6.1\n    │           │   │   ├── tauri-plugin-sample 0.1.0\n    │           │   │   │   └── api 0.1.0\n    │           │   │   └── tauri-plugin-log 2.6.0\n    │           │   │       └── api 0.1.0\n    │           │   ├── tauri-macros 2.6.1\n    │           │   │   └── tauri 2.11.1\n    │           │   ├── tauri-codegen 2.6.1\n    │           │   │   ├── tauri-macros 2.6.1\n    │           │   │   └── tauri-build 2.6.1\n    │           │   │       ├── tauri-file-associations-demo 0.1.0\n    │           │   │       ├── tauri 2.11.1\n    │           │   │       ├── resources 0.1.0\n    │           │   │       ├── bench_helloworld 0.1.0\n    │           │   │       ├── bench_files_transfer 0.1.0\n    │           │   │       ├── bench_cpu_intensive 0.1.0\n    │           │   │       └── api 0.1.0\n    │           │   ├── tauri-cli 2.11.1\n    │           │   │   └── tauri-cli-node 0.0.0\n    │           │   ├── tauri-bundler 2.9.1\n    │           │   │   └── tauri-cli 2.11.1\n    │           │   ├── tauri-build 2.6.1\n&lt;/tr&gt;&lt;/table&gt; \n</code></pre>\n</blockquote>\n<p>... (truncated)</p>\n</details>\n<details>\n<summary>Commits</summary>\n<ul>\n<li><a\nhref=\"https://github.com/tauri-apps/tauri/commit/e5ae5b93cdd310045191cc0526f253140ad64b87\"><code>e5ae5b9</code></a>\nchore: fix changelog</li>\n<li><a\nhref=\"https://github.com/tauri-apps/tauri/commit/4d2db70c46de515ed2c1e3752c841a8299623564\"><code>4d2db70</code></a>\nApply Version Updates From Current Changes (<a\nhref=\"https://redirect.github.com/tauri-apps/tauri/issues/15328\">#15328</a>)</li>\n<li><a\nhref=\"https://github.com/tauri-apps/tauri/commit/5e3126ff7045aec54811b227cb4d33d78b3957b5\"><code>5e3126f</code></a>\nfeat(mobile): expose monitor APIs (<a\nhref=\"https://redirect.github.com/tauri-apps/tauri/issues/15338\">#15338</a>)</li>\n<li><a\nhref=\"https://github.com/tauri-apps/tauri/commit/ba025588f3559858f43547e8c04424c47a3c445b\"><code>ba02558</code></a>\nMerge commit from fork</li>\n<li><a\nhref=\"https://github.com/tauri-apps/tauri/commit/5f479c0c364d7f5d89a83eaff66fbb7ef5045ce9\"><code>5f479c0</code></a>\nfix(core): requestPermission crash regression on Android, closes <a\nhref=\"https://redirect.github.com/tauri-apps/tauri/issues/15323\">#15323</a>\n(<a\nhref=\"https://redirect.github.com/tauri-apps/tauri/issues/15336\">#15336</a>)</li>\n<li><a\nhref=\"https://github.com/tauri-apps/tauri/commit/1b26769f92b54b158777a35a7f548f870f4e7901\"><code>1b26769</code></a>\nfix(tauri): enforce ACL for remote origins even without AppManifest (<a\nhref=\"https://redirect.github.com/tauri-apps/tauri/issues/15266\">#15266</a>)</li>\n<li><a\nhref=\"https://github.com/tauri-apps/tauri/commit/3057eda067b87761644209adeec077f232585c5d\"><code>3057eda</code></a>\nfix(driver): enable <code>eq-separator</code> feature for\n<code>pico-args</code>. (<a\nhref=\"https://redirect.github.com/tauri-apps/tauri/issues/15324\">#15324</a>)</li>\n<li><a\nhref=\"https://github.com/tauri-apps/tauri/commit/4f548e73947b3b06bf2073c822564aed3dd5f948\"><code>4f548e7</code></a>\nchore(deps): update phf to 0.13 (<a\nhref=\"https://redirect.github.com/tauri-apps/tauri/issues/15308\">#15308</a>)</li>\n<li><a\nhref=\"https://github.com/tauri-apps/tauri/commit/4ca427de5e1f657cc1609f76748f5ef960fd5a9f\"><code>4ca427d</code></a>\nfix: pin napi for msrv and Node.js on CI (<a\nhref=\"https://redirect.github.com/tauri-apps/tauri/issues/15310\">#15310</a>)</li>\n<li><a\nhref=\"https://github.com/tauri-apps/tauri/commit/a04d907b73e83e538792c7442af39c18561279eb\"><code>a04d907</code></a>\nfix(ci): publish-cli-rs script for Powershell (<a\nhref=\"https://redirect.github.com/tauri-apps/tauri/issues/15309\">#15309</a>)</li>\n<li>See full diff in <a\nhref=\"https://github.com/tauri-apps/tauri/compare/tauri-v2.11.0...tauri-v2.11.1\">compare\nview</a></li>\n</ul>\n</details>\n<br />\n\n\n[![Dependabot compatibility\nscore](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=tauri&package-manager=cargo&previous-version=2.11.0&new-version=2.11.1)](https://docs.github.com/en/github/managing-security-vulnerabilities/about-dependabot-security-updates#about-compatibility-scores)\n\nDependabot will resolve any conflicts with this PR as long as you don't\nalter it yourself. You can also trigger a rebase manually by commenting\n`@dependabot rebase`.\n\n[//]: # (dependabot-automerge-start)\n[//]: # (dependabot-automerge-end)\n\n---\n\n<details>\n<summary>Dependabot commands and options</summary>\n<br />\n\nYou can trigger Dependabot actions by commenting on this PR:\n- `@dependabot rebase` will rebase this PR\n- `@dependabot recreate` will recreate this PR, overwriting any edits\nthat have been made to it\n- `@dependabot show <dependency name> ignore conditions` will show all\nof the ignore conditions of the specified dependency\n- `@dependabot ignore this major version` will close this PR and stop\nDependabot creating any more for this major version (unless you reopen\nthe PR or upgrade to it yourself)\n- `@dependabot ignore this minor version` will close this PR and stop\nDependabot creating any more for this minor version (unless you reopen\nthe PR or upgrade to it yourself)\n- `@dependabot ignore this dependency` will close this PR and stop\nDependabot creating any more for this dependency (unless you reopen the\nPR or upgrade to it yourself)\nYou can disable automated security fix PRs for this repo from the\n[Security Alerts\npage](https://github.com/fjrevoredo/mini-diarium/network/alerts).\n\n</details>\n\nSigned-off-by: dependabot[bot] <support@github.com>\nCo-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>",
          "timestamp": "2026-05-09T02:32:14+02:00",
          "tree_id": "cf4365c3514cd4350d16bde412fbd049c952228f",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/fb795b67b479791247cc14d467d2039f9970a2e9"
        },
        "date": 1778287222584,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 92945910,
            "range": "± 906475",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 93578548,
            "range": "± 837253",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 2097,
            "range": "± 19",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 14136,
            "range": "± 39",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 167744,
            "range": "± 217",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1577,
            "range": "± 4",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 13461,
            "range": "± 21",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 132978,
            "range": "± 951",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 1029925,
            "range": "± 266001",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 842782,
            "range": "± 62840",
            "unit": "ns/iter"
          },
          {
            "name": "db_delete_entry",
            "value": 942828,
            "range": "± 83247",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 14350,
            "range": "± 232",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 32238,
            "range": "± 291",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 124989,
            "range": "± 807",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 141783,
            "range": "± 647",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 647685,
            "range": "± 3190",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 8845,
            "range": "± 31",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 11530,
            "range": "± 77",
            "unit": "ns/iter"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "49699333+dependabot[bot]@users.noreply.github.com",
            "name": "dependabot[bot]",
            "username": "dependabot[bot]"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "17dee72553f4f7d66bc118f2ba81c90e6abf84cf",
          "message": "Bump ip-address from 10.1.0 to 10.2.0 (#123)\n\nBumps [ip-address](https://github.com/beaugunderson/ip-address) from\n10.1.0 to 10.2.0.\n<details>\n<summary>Commits</summary>\n<ul>\n<li>See full diff in <a\nhref=\"https://github.com/beaugunderson/ip-address/commits\">compare\nview</a></li>\n</ul>\n</details>\n<br />\n\n\n[![Dependabot compatibility\nscore](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=ip-address&package-manager=npm_and_yarn&previous-version=10.1.0&new-version=10.2.0)](https://docs.github.com/en/github/managing-security-vulnerabilities/about-dependabot-security-updates#about-compatibility-scores)\n\nDependabot will resolve any conflicts with this PR as long as you don't\nalter it yourself. You can also trigger a rebase manually by commenting\n`@dependabot rebase`.\n\n[//]: # (dependabot-automerge-start)\n[//]: # (dependabot-automerge-end)\n\n---\n\n<details>\n<summary>Dependabot commands and options</summary>\n<br />\n\nYou can trigger Dependabot actions by commenting on this PR:\n- `@dependabot rebase` will rebase this PR\n- `@dependabot recreate` will recreate this PR, overwriting any edits\nthat have been made to it\n- `@dependabot show <dependency name> ignore conditions` will show all\nof the ignore conditions of the specified dependency\n- `@dependabot ignore this major version` will close this PR and stop\nDependabot creating any more for this major version (unless you reopen\nthe PR or upgrade to it yourself)\n- `@dependabot ignore this minor version` will close this PR and stop\nDependabot creating any more for this minor version (unless you reopen\nthe PR or upgrade to it yourself)\n- `@dependabot ignore this dependency` will close this PR and stop\nDependabot creating any more for this dependency (unless you reopen the\nPR or upgrade to it yourself)\nYou can disable automated security fix PRs for this repo from the\n[Security Alerts\npage](https://github.com/fjrevoredo/mini-diarium/network/alerts).\n\n</details>\n\nSigned-off-by: dependabot[bot] <support@github.com>\nCo-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>",
          "timestamp": "2026-05-09T03:19:39+02:00",
          "tree_id": "5d2fbf4505f3b56d0518a3c604de523268dff25e",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/17dee72553f4f7d66bc118f2ba81c90e6abf84cf"
        },
        "date": 1778290043288,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 92469914,
            "range": "± 84265",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 92120167,
            "range": "± 81611",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 2272,
            "range": "± 70",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 14623,
            "range": "± 33",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 139667,
            "range": "± 223",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1646,
            "range": "± 36",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 13796,
            "range": "± 19",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 136658,
            "range": "± 521",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 829020,
            "range": "± 66778",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 639556,
            "range": "± 15523",
            "unit": "ns/iter"
          },
          {
            "name": "db_delete_entry",
            "value": 767322,
            "range": "± 58898",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 14806,
            "range": "± 70",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 33347,
            "range": "± 150",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 119236,
            "range": "± 990",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 146761,
            "range": "± 626",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 681870,
            "range": "± 3916",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 8753,
            "range": "± 26",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 12050,
            "range": "± 61",
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
          "id": "bd88fd4b1a66a5fe5ab4bb306a9172a0b98b241f",
          "message": "v0.4.21",
          "timestamp": "2026-05-09T05:48:28+02:00",
          "tree_id": "edacf03c513a084338c518d86f1ea84cc9812ba8",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/bd88fd4b1a66a5fe5ab4bb306a9172a0b98b241f"
        },
        "date": 1778298987527,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 93907635,
            "range": "± 785825",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 94347527,
            "range": "± 1519335",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 2088,
            "range": "± 3",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 14152,
            "range": "± 19",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 168941,
            "range": "± 22260",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1577,
            "range": "± 2",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 13460,
            "range": "± 17",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 132923,
            "range": "± 185",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 1051147,
            "range": "± 227218",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 829927,
            "range": "± 37144",
            "unit": "ns/iter"
          },
          {
            "name": "db_delete_entry",
            "value": 937869,
            "range": "± 164948",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 14577,
            "range": "± 223",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 33716,
            "range": "± 133",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 128441,
            "range": "± 3265",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 142718,
            "range": "± 652",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 654732,
            "range": "± 1926",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 7627,
            "range": "± 513",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 10742,
            "range": "± 36",
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
          "id": "7e7f549caeaed90cccc488baefab88266913ae99",
          "message": "chore(release): clear latest changelog after v0.4.21 (#125)\n\nAutomated cleanup PR created after publishing v0.4.21. Removes\nlatest-changelog.md so the next release must create a fresh copy from\nlatest-changelog.example.md.\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-05-09T14:06:40+02:00",
          "tree_id": "b9561b5a9fadd93f8c5221d6414b2f7f78c9521d",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/7e7f549caeaed90cccc488baefab88266913ae99"
        },
        "date": 1778328849876,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 106667420,
            "range": "± 3124887",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 107586411,
            "range": "± 1620889",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 1790,
            "range": "± 4",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 12845,
            "range": "± 25",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 126742,
            "range": "± 575",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1442,
            "range": "± 4",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 12405,
            "range": "± 34",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 124335,
            "range": "± 170",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 799551,
            "range": "± 121083",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 628612,
            "range": "± 25794",
            "unit": "ns/iter"
          },
          {
            "name": "db_delete_entry",
            "value": 714191,
            "range": "± 91115",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 9641,
            "range": "± 61",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 29671,
            "range": "± 83",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 125783,
            "range": "± 2047",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 122251,
            "range": "± 582",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 569682,
            "range": "± 1259",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 7069,
            "range": "± 26",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 9700,
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
          "id": "65b3e350878a1ebe29ed7cfe195371af8212c53a",
          "message": "fix security issues",
          "timestamp": "2026-05-09T14:47:07+02:00",
          "tree_id": "232d575e43f62ff76ebe96385c2caa58ae4d4798",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/65b3e350878a1ebe29ed7cfe195371af8212c53a"
        },
        "date": 1778331298678,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 96301391,
            "range": "± 1746699",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 96336307,
            "range": "± 841374",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 2280,
            "range": "± 44",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 14607,
            "range": "± 20",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 140285,
            "range": "± 173",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1665,
            "range": "± 6",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 13810,
            "range": "± 20",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 136753,
            "range": "± 2173",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 886578,
            "range": "± 182532",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 676244,
            "range": "± 24433",
            "unit": "ns/iter"
          },
          {
            "name": "db_delete_entry",
            "value": 781549,
            "range": "± 123007",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 14940,
            "range": "± 77",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 33839,
            "range": "± 242",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 127239,
            "range": "± 686",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 146295,
            "range": "± 717",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 671734,
            "range": "± 38173",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 8743,
            "range": "± 378",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 11013,
            "range": "± 134",
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
          "id": "ab1caac519992bf4b12dc25cf77b424daf282e8e",
          "message": "v0.4.22 (#124)",
          "timestamp": "2026-05-14T00:19:55+02:00",
          "tree_id": "9743dcc6aed0f802fc9acf2a1f567214f54b8519",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/ab1caac519992bf4b12dc25cf77b424daf282e8e"
        },
        "date": 1778711250446,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 93481282,
            "range": "± 1252619",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 93143815,
            "range": "± 687112",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 2120,
            "range": "± 45",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 14156,
            "range": "± 26",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 169504,
            "range": "± 4167",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1576,
            "range": "± 10",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 13440,
            "range": "± 31",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 132990,
            "range": "± 403",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 1071970,
            "range": "± 500479",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 1004900,
            "range": "± 65839",
            "unit": "ns/iter"
          },
          {
            "name": "db_delete_entry",
            "value": 979157,
            "range": "± 395147",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 14032,
            "range": "± 126",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 33200,
            "range": "± 135",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 127909,
            "range": "± 603",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 141972,
            "range": "± 1476",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 649311,
            "range": "± 25745",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 6758,
            "range": "± 84",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 8655,
            "range": "± 155",
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
          "id": "f3f0c6ffed24a1962f3f509a708c61a8570b4d7a",
          "message": "chore(release): clear latest changelog after v0.4.22 (#129)\n\nAutomated cleanup PR created after publishing v0.4.22. Removes\nlatest-changelog.md so the next release must create a fresh copy from\nlatest-changelog.example.md.\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-05-14T01:01:03+02:00",
          "tree_id": "0b3b500e22c732a1e68e735a261557e3327e1ffc",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/f3f0c6ffed24a1962f3f509a708c61a8570b4d7a"
        },
        "date": 1778713718599,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 92170240,
            "range": "± 77826",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 92536319,
            "range": "± 2217319",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 2283,
            "range": "± 17",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 14621,
            "range": "± 22",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 139721,
            "range": "± 328",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1669,
            "range": "± 4",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 13810,
            "range": "± 84",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 136696,
            "range": "± 2507",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 850260,
            "range": "± 72669",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 636229,
            "range": "± 45085",
            "unit": "ns/iter"
          },
          {
            "name": "db_delete_entry",
            "value": 782332,
            "range": "± 68474",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 14804,
            "range": "± 35",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 33926,
            "range": "± 124",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 121794,
            "range": "± 629",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 145355,
            "range": "± 1940",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 669848,
            "range": "± 2662",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 4537,
            "range": "± 334",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 6306,
            "range": "± 25",
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
          "id": "347994e79df4914ce4df113d0e26b6f92a600682",
          "message": "benchmark fix",
          "timestamp": "2026-05-14T01:05:23+02:00",
          "tree_id": "7f977d4e98f54a3febc6c6901df05ce762f651b8",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/347994e79df4914ce4df113d0e26b6f92a600682"
        },
        "date": 1778714182204,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 99290935,
            "range": "± 263847",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 98671065,
            "range": "± 1299375",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 1794,
            "range": "± 3",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 12821,
            "range": "± 28",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 126305,
            "range": "± 529",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1454,
            "range": "± 3",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 12394,
            "range": "± 16",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 123804,
            "range": "± 313",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 774821,
            "range": "± 77732",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 560141,
            "range": "± 21981",
            "unit": "ns/iter"
          },
          {
            "name": "db_delete_entry",
            "value": 681442,
            "range": "± 74914",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 9584,
            "range": "± 26",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 29493,
            "range": "± 157",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 121031,
            "range": "± 1030",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 122533,
            "range": "± 406",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 569671,
            "range": "± 4410",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 4576,
            "range": "± 32",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 5818,
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
          "id": "c7c2235c4eacd717e19438f054471a89d7cad982",
          "message": "fix time benchmark",
          "timestamp": "2026-05-14T02:03:10+02:00",
          "tree_id": "3290240826433b410cbf40bed45c6d7e03a4b893",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/c7c2235c4eacd717e19438f054471a89d7cad982"
        },
        "date": 1778717485439,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 89701764,
            "range": "± 226819",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 89915095,
            "range": "± 385734",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 2109,
            "range": "± 19",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 14188,
            "range": "± 94",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 167766,
            "range": "± 1163",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1579,
            "range": "± 3",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 13454,
            "range": "± 35",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 132891,
            "range": "± 213",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 1066853,
            "range": "± 133677",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 900141,
            "range": "± 66401",
            "unit": "ns/iter"
          },
          {
            "name": "db_delete_entry",
            "value": 912503,
            "range": "± 118254",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 14716,
            "range": "± 123",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 32703,
            "range": "± 313",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 128946,
            "range": "± 2227",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 143420,
            "range": "± 492",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 659710,
            "range": "± 2710",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 6766,
            "range": "± 27",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 8646,
            "range": "± 74",
            "unit": "ns/iter"
          },
          {
            "name": "ci_pipeline_duration",
            "value": 481000000000,
            "range": "± 0",
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
          "id": "0ed9918e84919905ef9bca9839536a7099916e2a",
          "message": "another ci fix",
          "timestamp": "2026-05-14T02:32:18+02:00",
          "tree_id": "32c8d58857604db904d7262c7cbe93c275f5ebf7",
          "url": "https://github.com/fjrevoredo/mini-diarium/commit/0ed9918e84919905ef9bca9839536a7099916e2a"
        },
        "date": 1778719207569,
        "tool": "cargo",
        "benches": [
          {
            "name": "auth_argon2/wrap_master_key",
            "value": 79487203,
            "range": "± 639304",
            "unit": "ns/iter"
          },
          {
            "name": "auth_argon2/unwrap_master_key",
            "value": 79355758,
            "range": "± 514587",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/1024",
            "value": 1789,
            "range": "± 14",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/10240",
            "value": 11468,
            "range": "± 22",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_encrypt/102400",
            "value": 110307,
            "range": "± 1521",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/1024",
            "value": 1294,
            "range": "± 1",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/10240",
            "value": 10854,
            "range": "± 11",
            "unit": "ns/iter"
          },
          {
            "name": "cipher_decrypt/102400",
            "value": 107261,
            "range": "± 101",
            "unit": "ns/iter"
          },
          {
            "name": "db_insert_entry",
            "value": 1132855,
            "range": "± 20759214",
            "unit": "ns/iter"
          },
          {
            "name": "db_update_entry",
            "value": 907965,
            "range": "± 2022871",
            "unit": "ns/iter"
          },
          {
            "name": "db_delete_entry",
            "value": 988065,
            "range": "± 1130128",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_entries_by_date",
            "value": 11456,
            "range": "± 32",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/100",
            "value": 26250,
            "range": "± 176",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entry_dates/500",
            "value": 95717,
            "range": "± 577",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/100",
            "value": 115299,
            "range": "± 1069",
            "unit": "ns/iter"
          },
          {
            "name": "db_get_all_entries/500",
            "value": 527253,
            "range": "± 8727",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_plain_500w",
            "value": 3509,
            "range": "± 16",
            "unit": "ns/iter"
          },
          {
            "name": "count_words_html_500w",
            "value": 5161,
            "range": "± 28",
            "unit": "ns/iter"
          },
          {
            "name": "ci_pipeline_duration",
            "value": 457000000000,
            "range": "± 0",
            "unit": "ns/iter"
          }
        ]
      }
    ]
  }
}