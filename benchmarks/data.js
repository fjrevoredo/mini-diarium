window.BENCHMARK_DATA = {
  "lastUpdate": 1776630814652,
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
      }
    ]
  }
}