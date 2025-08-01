var debugmode = false;

var states = Object.freeze({
  SplashScreen: 0,
  GameScreen: 1,
  ScoreScreen: 2,
});

var currentstate;

var gravity = 0.25;
var velocity = 0;
var position = 180;
var rotation = 0;
var jump = -4.6;
var flyArea = $("#flyarea").height();

var score = 0;
var highscore = 0;

var pipeheight = 90;
var pipewidth = 52;
var pipes = new Array();

var replayclickable = false;
var hasShield = false;
var shieldTimeout = null;
var shieldColorSwitchInterval = null;
var isShrunk = false;
var shrinkTimeout = null;
var shrinkBlinkTimeout = null;
var poisonCount = 0;
var poisonTimer = null;


var volume = 30;
var soundJump = new buzz.sound("assets/sounds/sfx_wing.ogg");
var soundScore = new buzz.sound("assets/sounds/sfx_point.ogg");
var soundHit = new buzz.sound("assets/sounds/sfx_hit.ogg");
var soundDie = new buzz.sound("assets/sounds/sfx_die.ogg");
var soundSwoosh = new buzz.sound("assets/sounds/sfx_swooshing.ogg");
buzz.all().setVolume(volume);

randomizeBirdColor();

var loopGameloop;
var loopPipeloop;

$(document).ready(function () {
  if (window.location.search == "?debug") debugmode = true;
  if (window.location.search == "?easy") pipeheight = 200;

  var savedscore = getCookie("highscore");
  if (savedscore != "") highscore = parseInt(savedscore);

  showSplash();
});

function getCookie(cname) {
  var name = cname + "=";
  var ca = document.cookie.split(";");
  for (var i = 0; i < ca.length; i++) {
    var c = ca[i].trim();
    if (c.indexOf(name) == 0) return c.substring(name.length, c.length);
  }
  return "";
}

function setCookie(cname, cvalue, exdays) {
  var d = new Date();
  d.setTime(d.getTime() + exdays * 24 * 60 * 60 * 1000);
  var expires = "expires=" + d.toGMTString();
  document.cookie = cname + "=" + cvalue + "; " + expires;
}

function showSplash() {
  currentstate = states.SplashScreen;

  velocity = 0;
  position = 180;
  rotation = 0;
  score = 0;

  $("#player").css({ y: 0, x: 0 });
  updatePlayer($("#player"));

  soundSwoosh.stop();
  soundSwoosh.play();

  $(".pipe").remove();
  pipes = new Array();

  $(".animated").css("animation-play-state", "running");
  $(".animated").css("-webkit-animation-play-state", "running");

  $("#splash").transition({ opacity: 1 }, 2000, "ease");
  $("#powerup-guide").show();

}

function startGame() {
  currentstate = states.GameScreen;
  startDayNightCycle();

  $("#splash").stop();
  $("#splash").transition({ opacity: 0 }, 500, "ease");
  $("#powerup-guide").hide();

  setBigScore();

  if (debugmode) {
    $(".boundingbox").show();
  }

  $(".powerup").remove();
  powerups = [];

  var updaterate = 1000.0 / 60.0;
  loopGameloop = setInterval(gameloop, updaterate);
  loopPipeloop = setInterval(updatePipes, 1400);
  loopPowerUp = setInterval(spawnPowerUp, 5000);

  playerJump();
}

function flashPowerUpEffect() {
  const flash = $("#powerup-flash");
  flash.stop(true, true).css({
    opacity: 1,
    display: "block"
  });

  setTimeout(() => {
    flash.fadeOut(150);
  }, 50);
}

function showPowerText(message = "POWER!") {
  const text = $("#powerup-text");
  text.text(message).stop(true, true)
    .css({
      opacity: 1,
      transform: "translateX(-50%) scale(1.2)"
    })
    .delay(2000)
    .queue(function (next) {
      $(this).css({
        opacity: 0,
        transform: "translateX(-50%) scale(0.8)"
      });
      next();
    });
}


var loopDayNight;

function startDayNightCycle() {
  let isNight = false;
  loopDayNight = setInterval(() => {
    isNight = !isNight;
    if (isNight) {
      $("#sky").addClass("night-mode");
    } else {
      $("#sky").removeClass("night-mode");
    }
  }, 10000);
}


function updatePlayer(player) {
  rotation = Math.min((velocity / 10) * 90, 90);

  $(player).css({ rotate: rotation, top: position });
}

function gameloop() {
  var player = $("#player");

  velocity += gravity;
  position += velocity;

  updatePlayer(player);

  var box = document.getElementById("player").getBoundingClientRect();
  var origwidth = 34.0;
  var origheight = 24.0;

  var boxwidth = origwidth - Math.sin(Math.abs(rotation) / 90) * 8;
  var boxheight = (origheight + box.height) / 2;
  var boxleft = (box.width - boxwidth) / 2 + box.left;
  var boxtop = (box.height - boxheight) / 2 + box.top;
  var boxright = boxleft + boxwidth;
  var boxbottom = boxtop + boxheight;

  if (debugmode) {
    var boundingbox = $("#playerbox");
    boundingbox.css("left", boxleft);
    boundingbox.css("top", boxtop);
    boundingbox.css("height", boxheight);
    boundingbox.css("width", boxwidth);
  }

  if (box.bottom >= $("#land").offset().top) {
    playerDead();
    return;
  }

  var ceiling = $("#ceiling");
  if (boxtop <= ceiling.offset().top + ceiling.height()) position = 0;

  if (pipes[0] == null) return;

  var nextpipe = pipes[0];
  var nextpipeupper = nextpipe.children(".pipe_upper");

  var pipetop = nextpipeupper.offset().top + nextpipeupper.height();
  var pipeleft = nextpipeupper.offset().left - 2;
  var piperight = pipeleft + pipewidth;
  var pipebottom = pipetop + pipeheight;

  if (debugmode) {
    var boundingbox = $("#pipebox");
    boundingbox.css("left", pipeleft);
    boundingbox.css("top", pipetop);
    boundingbox.css("height", pipeheight);
    boundingbox.css("width", pipewidth);
  }

  if (!hasShield) {
    if (boxright > pipeleft) {
      if (boxtop > pipetop && boxbottom < pipebottom) {
      } else {
        playerDead();
        return;
      }
    }
  }

  if (boxleft > piperight) {
    pipes.splice(0, 1);

    playerScore();
  }

  for (let i = 0; i < powerups.length; i++) {
    let pu = powerups[i];
    let puBox = pu[0].getBoundingClientRect();

    if (
      boxright > puBox.left &&
      boxleft < puBox.right &&
      boxbottom > puBox.top &&
      boxtop < puBox.bottom
    ) {
      if (pu.hasClass("shrinkpowerup")) {
        if (!isShrunk) {
          isShrunk = true;
          $("#player").css({
            transform: "scale(0.5)",
            "transform-origin": "center center",
          });
        }

        if (shrinkTimeout) clearTimeout(shrinkTimeout);
        if (shrinkBlinkTimeout) clearTimeout(shrinkBlinkTimeout);

        shrinkTimeout = setTimeout(() => {
          $("#player").css("transform", "");
          isShrunk = false;
        }, 10000);

        shrinkBlinkTimeout = setTimeout(() => {
          let blinkCount = 0;
          const maxBlinks = 6;
          const blinkInterval = setInterval(() => {
            flashPowerUpEffect();
            blinkCount++;
            if (blinkCount >= maxBlinks) clearInterval(blinkInterval);
          }, 333);
        }, 8000);
      } else if (pu.hasClass("shieldpowerup")) {
        hasShield = true;
        $("#player").css("filter", "drop-shadow(0 0 10px pink)");

        if (shieldColorSwitchInterval) clearInterval(shieldColorSwitchInterval);
        shieldColorSwitchInterval = setInterval(() => {
          randomizeBirdColor();
        }, 100);

        if (shieldTimeout) clearTimeout(shieldTimeout);
        shieldTimeout = setTimeout(() => {
          hasShield = false;
          $("#player").css("filter", "");
          clearInterval(shieldColorSwitchInterval);
          shieldColorSwitchInterval = null;
          randomizeBirdColor();
        }, 5000);

        setTimeout(() => {
          let blinkCount = 0;
          const maxBlinks = 6;

          const blinkInterval = setInterval(() => {
            flashPowerUpEffect();
            blinkCount++;
            if (blinkCount >= maxBlinks) {
              clearInterval(blinkInterval);
            }
          }, 333);
        }, 3000);
      } else if (pu.hasClass("poisonpowerup")) {
        score -= 3;
        if (score < 0) score = 0;

        setBigScore();
        showPowerText("Oops! Spoiled Egg! -3");
      }
      else {
        score += 5;
        setBigScore();
      }

      pu.remove();
      powerups.splice(i, 1);
      i--;
      soundScore.stop();
      soundScore.play();
      if (pu.hasClass("shrinkpowerup")) {
        showPowerText("You ate a Minibon for Shrink!");
      } else if (pu.hasClass("shieldpowerup")) {
        showPowerText("You ate an Onion for Invincibility!");
      } else if (pu.hasClass("poisonpowerup")) {
        showPowerText("Oops! Spoiled Egg! -3");
      } else {
        showPowerText("You catched an Egg for +5!");
      }
    }
  }
}

$(document).keydown(function (e) {
  if (e.keyCode == 32) {
    if (currentstate == states.ScoreScreen) $("#replay").click();
    else screenClick();
  }
});

if ("ontouchstart" in window) $(document).on("touchstart", screenClick);
else $(document).on("mousedown", screenClick);

function screenClick() {
  if (currentstate == states.GameScreen) {
    playerJump();
  } else if (currentstate == states.SplashScreen) {
    startGame();
  }
}

function playerJump() {
  velocity = jump;
  soundJump.stop();
  soundJump.play();
}

function setBigScore(erase) {
  var elemscore = $("#bigscore");
  elemscore.empty();

  if (erase) return;

  var digits = score.toString().split("");
  for (var i = 0; i < digits.length; i++)
    elemscore.append(
      "<img src='assets/font_big_" +
      digits[i] +
      ".png' alt='" +
      digits[i] +
      "'>"
    );
}

function setSmallScore() {
  var elemscore = $("#currentscore");
  elemscore.empty();

  var digits = score.toString().split("");
  for (var i = 0; i < digits.length; i++)
    elemscore.append(
      "<img src='assets/font_small_" +
      digits[i] +
      ".png' alt='" +
      digits[i] +
      "'>"
    );
}

function setHighScore() {
  var elemscore = $("#highscore");
  elemscore.empty();

  var digits = highscore.toString().split("");
  for (var i = 0; i < digits.length; i++)
    elemscore.append(
      "<img src='assets/font_small_" +
      digits[i] +
      ".png' alt='" +
      digits[i] +
      "'>"
    );
}

function setMedal() {
  var elemmedal = $("#medal");
  elemmedal.empty();

  if (score < 10)
    return false;

  if (score >= 10) medal = "bronze";
  if (score >= 30) medal = "silver";
  if (score >= 50) medal = "gold";
  if (score >= 80) medal = "platinum";

  elemmedal.append(
    '<img src="assets/medal_' + medal + '.png" alt="' + medal + '">'
  );

  return true;
}

function playerDead() {
  $(".animated").css("animation-play-state", "paused");
  $(".animated").css("-webkit-animation-play-state", "paused");

  $("#player").css("transform", "");

  var birdBox = document.getElementById("player").getBoundingClientRect();
  var playerbottom = $("#player").position().top + birdBox.height;
  var floor = flyArea;
  var movey = Math.max(0, floor - playerbottom);

  $("#player").transition(
    { y: movey + "px", rotate: 90 },
    1000,
    "easeInOutCubic"
  );

  currentstate = states.ScoreScreen;

  clearInterval(loopGameloop);
  clearInterval(loopPipeloop);
  loopGameloop = null;
  loopPipeloop = null;
  clearInterval(loopPowerUp);
  loopPowerUp = null;


  if (isIncompatible.any()) {
    showScore();
  } else {
    soundHit.play().bindOnce("ended", function () {
      soundDie.play().bindOnce("ended", function () {
        showScore();
      });
    });
  }
  clearInterval(loopDayNight);
  loopDayNight = null;
  $("#sky").removeClass("night-mode");

  if (shrinkTimeout) {
    clearTimeout(shrinkTimeout);
    shrinkTimeout = null;
  }
  if (shrinkBlinkTimeout) {
    clearTimeout(shrinkBlinkTimeout);
    shrinkBlinkTimeout = null;
  }
  isShrunk = false;
  if (isShrunk) {
    const currentRotation = rotation || 0;
    $("#player").css("transform", `rotate(${currentRotation}deg) scale(1)`);
    isShrunk = false;
  } else {
  }


}

function showScore() {
  $("#scoreboard").css("display", "block");

  setBigScore(true);

  if (score > highscore) {
    highscore = score;
    setCookie("highscore", highscore, 999);
  }

  setSmallScore();
  setHighScore();
  var wonmedal = setMedal();

  soundSwoosh.stop();
  soundSwoosh.play();

  $("#scoreboard").css({ y: "40px", opacity: 0 });
  $("#replay").css({ y: "40px", opacity: 0 });
  $("#scoreboard").transition(
    { y: "0px", opacity: 1 },
    600,
    "ease",
    function () {
      soundSwoosh.stop();
      soundSwoosh.play();
      $("#replay").transition({ y: "0px", opacity: 1 }, 600, "ease");

      if (wonmedal) {
        $("#medal").css({ scale: 2, opacity: 0 });
        $("#medal").transition({ opacity: 1, scale: 1 }, 1200, "ease");
      }
    }
  );

  replayclickable = true;
}

$("#replay").click(function () {
  if (!replayclickable) return;
  else replayclickable = false;
  soundSwoosh.stop();
  soundSwoosh.play();

  $("#scoreboard").transition(
    { y: "-40px", opacity: 0 },
    1000,
    "ease",
    function () {
      $("#scoreboard").css("display", "none");

      showSplash();

      randomizeBirdColor();
    }
  );
});

function playerScore() {
  score += 1;
  soundScore.stop();
  soundScore.play();
  setBigScore();
}

function updatePipes() {
  $(".pipe")
    .filter(function () {
      return $(this).position().left <= -100;
    })
    .remove();

  var padding = 80;
  var constraint = flyArea - pipeheight - padding * 2;
  var topheight = Math.floor(Math.random() * constraint + padding);
  var bottomheight = flyArea - pipeheight - topheight;
  var newpipe = $(
    '<div class="pipe animated"><div class="pipe_upper" style="height: ' +
    topheight +
    'px;"></div><div class="pipe_lower" style="height: ' +
    bottomheight +
    'px;"></div></div>'
  );
  $("#flyarea").append(newpipe);
  pipes.push(newpipe);
}

var powerups = [];

function spawnPowerUp() {
  if (currentstate !== states.GameScreen) return;

  // 30% chance to spawn 2 power-ups
  const howMany = Math.random() < 0.3 ? 2 : 1;

  for (let i = 0; i < howMany; i++) {
    const powerup = $('<div class="powerup animated"></div>');

    // Random movement speed between 2 to 6 seconds
    let duration = Math.random() * (6 - 2) + 2;
    powerup.css({
      animationDuration: duration + "s",
      WebkitAnimationDuration: duration + "s",
    });

    // Random power-up type
    // Random power-up type
    const rand = Math.random();
    if (rand < 0.25) {
      powerup.addClass("shieldpowerup");
    } else if (rand < 0.5) {
      powerup.addClass("scorepowerup");
    } else if (rand < 0.75) {
      powerup.addClass("shrinkpowerup");
    } else {
      powerup.addClass("poisonpowerup");
    }


    // Random vertical position (avoid perfect overlap)
    const buffer = 40 * i; // offset second powerup vertically
    var top = Math.floor(Math.random() * (flyArea - 100)) + 30 + buffer;
    powerup.css("top", top + "px");

    $("#flyarea").append(powerup);
    powerups.push(powerup);

    // Cleanup after power-up moves across screen
    setTimeout(() => {
      powerup.remove();
      const index = powerups.indexOf(powerup);
      if (index !== -1) {
        powerups.splice(index, 1);
      }
    }, duration * 1000 + 500); // safe buffer
  }
}

var isIncompatible = {
  Android: function () {
    return navigator.userAgent.match(/Android/i);
  },
  BlackBerry: function () {
    return navigator.userAgent.match(/BlackBerry/i);
  },
  iOS: function () {
    return navigator.userAgent.match(/iPhone|iPad|iPod/i);
  },
  Opera: function () {
    return navigator.userAgent.match(/Opera Mini/i);
  },
  Safari: function () {
    return (
      navigator.userAgent.match(/OS X.*Safari/) &&
      !navigator.userAgent.match(/Chrome/)
    );
  },
  Windows: function () {
    return navigator.userAgent.match(/IEMobile/i);
  },
  any: function () {
    return (
      isIncompatible.Android() ||
      isIncompatible.BlackBerry() ||
      isIncompatible.iOS() ||
      isIncompatible.Opera() ||
      isIncompatible.Safari() ||
      isIncompatible.Windows()
    );
  },
};

function randomizeBirdColor() {
  var birdClasses = [
    "bird animated bird-1",
    "bird animated bird-2",
    "bird animated bird-3",
    "bird animated bird-4",
    "bird animated bird-5",
  ];
  var randomBirdClass =
    birdClasses[Math.floor(Math.random() * birdClasses.length)];

  $(player).removeClass().addClass(randomBirdClass);
}
