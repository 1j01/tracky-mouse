{
  "targets": [
    {
      "target_name": "tracky_mouse_native",
      "sources": [ "src/tracky_mouse_native.cc" ],
      "conditions": [
        [ 'OS=="win"', {
          "libraries": [ "user32.lib" ]
        }]
      ]
    }
  ]
}
