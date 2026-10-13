// ============================================
// RIVO — Part 1 of 6 (FINAL)
// Imports + Config + Helpers + Auth + ScreenHeader
// ============================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Pressable,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  Modal,
  Dimensions,
  Animated,
  StatusBar as RNStatusBar,
  Switch,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { createClient } from '@supabase/supabase-js';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_700Bold,
  Poppins_900Black,
} from '@expo-google-fonts/poppins';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

// ⚠️ FileSystem import नहीं — SDK 54 में fetch-based upload use करेंगे

// ============================================
// SUPABASE CONFIG
// ============================================
const SUPABASE_URL = 'https://ijawfcudtqfbnwqvusam.supabase.co';
const SUPABASE_KEY = 'sb_publishable_A46KyIhswQS9bIpSMxvlMQ_HGl0m5qY';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ============================================
// NOTIFICATIONS
// ============================================
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function registerForPushNotifications(userId) {
  try {
    if (!Device.isDevice) return null;
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'RIVO Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7b2ff7',
      });
    }
    let token = null;
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync();
      token = tokenData?.data;
    } catch (e) {
      console.log('Push token skip:', e.message);
    }
    if (token && userId) {
      await supabase
        .from('push_tokens')
        .upsert(
          { user_id: userId, token, platform: Platform.OS },
          { onConflict: 'user_id,token' }
        );
    }
    return token;
  } catch (e) {
    return null;
  }
}

// ============================================
// HELPERS
// ============================================
function formatDate(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function formatCount(n) {
  n = Number(n || 0);
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(d) {
  if (!d) return '';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const day = Math.floor(h / 24);
  if (day < 7) return `${day}d`;
  return new Date(d).toLocaleDateString();
}

function formatPrice(price) {
  if (!price) return 'Free';
  return `₹${Number(price).toLocaleString('en-IN')}`;
}

function getErrorMessage(error, fallback = 'Something went wrong.') {
  return error?.message || error?.error_description || fallback;
}

// ============================================
// SMALL COMPONENTS
// ============================================
function UserAvatar({ avatarUrl, username, size = 38 }) {
  if (avatarUrl)
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#222',
        }}
      />
    );
  const letter = (username || 'U').charAt(0).toUpperCase();
  return (
    <LinearGradient
      colors={['#1877F2', '#7b2ff7']}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text
        style={{
          color: '#fff',
          fontWeight: '900',
          fontSize: size / 2.2,
          fontFamily: 'Poppins_900Black',
        }}>
        {letter}
      </Text>
    </LinearGradient>
  );
}

function VerifiedBadge({ size = 14 }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#1DA1F2',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 4,
      }}>
      <Feather name="check" size={size * 0.7} color="#fff" />
    </View>
  );
}

// ============================================
// SCREEN HEADER (Universal)
// ============================================
function ScreenHeader({ title, onBack, rightIcon, onRightPress }) {
  return (
    <View style={styles.screenHeaderBar}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={styles.screenHeaderBtn}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
      ) : (
        <View style={styles.screenHeaderBtn} />
      )}
      <Text style={styles.screenHeaderTitle} numberOfLines={1}>
        {title}
      </Text>
      {rightIcon ? (
        <TouchableOpacity onPress={onRightPress} style={styles.screenHeaderBtn}>
          <Feather name={rightIcon} size={24} color="#fff" />
        </TouchableOpacity>
      ) : (
        <View style={styles.screenHeaderBtn} />
      )}
    </View>
  );
}

// ============================================
// AUTH SCREENS
// ============================================
function LoginScreen({ onSignup, onForgot }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const login = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Rivo', 'Email और password डालें।');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) Alert.alert('Login failed', error.message);
  };

  return (
    <SafeAreaView style={styles.authScreen} edges={['top', 'bottom']}>
      <LinearGradient colors={['#1877F2', '#7b2ff7']} style={styles.authLogo}>
        <Text style={styles.authLogoText}>R</Text>
      </LinearGradient>
      <Text style={styles.authTitle}>RIVO</Text>
      <Text style={styles.authSubtitle}>Connect. Share. Discover.</Text>

      <TextInput
        style={styles.authInput}
        placeholder="Email"
        placeholderTextColor="#777"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.authInput}
        placeholder="Password"
        placeholderTextColor="#777"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={login}
        disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryButtonText}>Login</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={onForgot} style={styles.linkButton}>
        <Text style={styles.linkText}>Forgot Password?</Text>
      </TouchableOpacity>

      <View style={styles.authDivider}>
        <View style={styles.dividerLine} />
        <Text style={styles.orText}>OR</Text>
        <View style={styles.dividerLine} />
      </View>

      <TouchableOpacity onPress={onSignup} style={styles.outlineButton}>
        <Text style={styles.outlineButtonText}>Create New Account</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function SignupScreen({ onBack }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  const signup = async () => {
    if (!email.trim() || !password || !username.trim()) {
      Alert.alert('Rivo', 'सभी details भरें।');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Rivo', 'Password कम से कम 6 characters।');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    if (error) {
      setLoading(false);
      Alert.alert('Signup failed', error.message);
      return;
    }
    if (data?.user?.id) {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ id: data.user.id, username: username.trim() });
      if (profileError) {
        setLoading(false);
        Alert.alert(
          'Profile setup failed',
          getErrorMessage(profileError, 'Profile create नहीं हो पाया।')
        );
        return;
      }
    }
    setLoading(false);
    Alert.alert(
      'Rivo',
      data?.session
        ? 'Account बन गया है।'
        : 'Account बन गया है। अगर email confirmation on है तो पहले email verify करें।'
    );
    onBack();
  };

  return (
    <SafeAreaView style={styles.authScreen} edges={['top', 'bottom']}>
      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <Feather name="arrow-left" size={24} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.authTitle}>Create Account</Text>
      <Text style={styles.authSubtitle}>Join Rivo</Text>

      <TextInput
        style={styles.authInput}
        placeholder="Username"
        placeholderTextColor="#777"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.authInput}
        placeholder="Email"
        placeholderTextColor="#777"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.authInput}
        placeholder="Password"
        placeholderTextColor="#777"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={signup}
        disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryButtonText}>Sign Up</Text>
        )}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function ForgotPasswordScreen({ onBack }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const resetPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Rivo', 'Email डालें।');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    Alert.alert('Rivo', 'Password reset email भेज दिया गया है।');
  };

  return (
    <SafeAreaView style={styles.authScreen} edges={['top', 'bottom']}>
      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <Feather name="arrow-left" size={24} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.authTitle}>Reset Password</Text>
      <Text style={styles.authSubtitle}>अपना registered email डालें।</Text>

      <TextInput
        style={styles.authInput}
        placeholder="Email"
        placeholderTextColor="#777"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={resetPassword}
        disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryButtonText}>Send Reset Email</Text>
        )}
      </TouchableOpacity>
    </SafeAreaView>
  );
}
// ============================================
// RIVO — Part 2 of 6 (FINAL)
// Camera + Video + Media Upload (fetch-based) + Story
// ============================================

// ============================================
// CAMERA SCREEN
// ============================================
function CameraScreen({ onClose, onCaptured }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('back');
  const [flash, setFlash] = useState('off');
  const [mode, setMode] = useState('picture');
  const [recording, setRecording] = useState(false);
  const cameraRef = useRef(null);

  if (!permission)
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );

  if (!permission.granted) {
    return (
      <SafeAreaView
        style={styles.cameraPermissionScreen}
        edges={['top', 'bottom']}>
        <Feather name="camera-off" size={60} color="#777" />
        <Text style={styles.cameraPermissionTitle}>
          Camera Permission Needed
        </Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} style={{ marginTop: 15 }}>
          <Text style={styles.linkText}>Cancel</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const capturePhoto = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) onCaptured({ uri: photo.uri, type: 'image' });
    } catch (e) {
      Alert.alert('Error', e?.message);
    }
  };

  const startRecording = async () => {
    if (!cameraRef.current || recording) return;
    try {
      setRecording(true);
      const videoPromise = cameraRef.current.recordAsync({ maxDuration: 60 });
      if (videoPromise) {
        const video = await videoPromise;
        if (video?.uri) onCaptured({ uri: video.uri, type: 'video' });
      }
    } catch (e) {
      Alert.alert('Error', e?.message);
    } finally {
      setRecording(false);
    }
  };

  const stopRecording = () => {
    if (cameraRef.current && recording) cameraRef.current.stopRecording();
  };

  const handleCapture = () => {
    if (mode === 'picture') capturePhoto();
    else {
      recording ? stopRecording() : startRecording();
    }
  };

  return (
    <View style={styles.cameraContainer}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        flash={flash}
        mode={mode}
      />
      <SafeAreaView style={styles.cameraTopBar} edges={['top']}>
        <TouchableOpacity onPress={onClose} style={styles.cameraTopBtn}>
          <Feather name="x" size={26} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setFlash((f) => (f === 'off' ? 'on' : 'off'))}
          style={styles.cameraTopBtn}>
          <Feather
            name={flash === 'on' ? 'zap' : 'zap-off'}
            size={22}
            color="#fff"
          />
        </TouchableOpacity>
      </SafeAreaView>
      <View style={styles.cameraBottomBar}>
        <View style={styles.cameraModeRow}>
          <TouchableOpacity onPress={() => setMode('picture')}>
            <Text
              style={[
                styles.cameraModeText,
                mode === 'picture' && styles.cameraModeActive,
              ]}>
              PHOTO
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode('video')}>
            <Text
              style={[
                styles.cameraModeText,
                mode === 'video' && styles.cameraModeActive,
              ]}>
              VIDEO
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.cameraCaptureRow}>
          <View style={{ width: 50 }} />
          <TouchableOpacity
            onPress={handleCapture}
            style={styles.cameraCaptureBtn}>
            <View
              style={[
                styles.cameraCaptureInner,
                mode === 'video' && styles.cameraCaptureInnerVideo,
                recording && { backgroundColor: '#ff3040' },
              ]}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
            style={styles.cameraFlipBtn}>
            <Feather name="refresh-cw" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ============================================
// VIDEO PLAYERS
// ============================================
function PostVideoPlayer({ uri, shouldPlay, aspectRatio = 1 }) {
  const [videoError, setVideoError] = useState(null);
  const [videoReady, setVideoReady] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = false;
  });

  const { status, error } = useEvent(player, 'statusChange', {
    status: 'idle',
    error: null,
  });

  useEffect(() => {
    if (error) setVideoError(error?.message || 'Video load नहीं हो पाया।');
  }, [error]);

  useEffect(() => {
    if (!player) return;
    if (status === 'readyToPlay') {
      setVideoReady(true);
      setVideoError(null);
    }
    try {
      if (fullscreen) {
        player.play();
      } else if (shouldPlay && status === 'readyToPlay') {
        player.play();
      } else {
        player.pause();
      }
    } catch (e) {
      console.log(e);
    }
  }, [shouldPlay, status, player, fullscreen]);

  return (
    <>
      <View style={[styles.videoPostContainer, { aspectRatio }]}>
        <VideoView
          player={player}
          style={styles.postVideo}
          contentFit="cover"
          nativeControls={false}
        />
        <Pressable
          style={styles.videoTapLayer}
          onPress={() => setFullscreen(true)}>
          {!videoReady && !videoError && (
            <View style={styles.videoLoading}>
              <ActivityIndicator color="#fff" size="large" />
            </View>
          )}
        </Pressable>
        {videoError && (
          <View style={styles.videoError}>
            <Feather name="alert-circle" size={28} color="#fff" />
            <Text style={styles.videoErrorText}>Video play नहीं हो पाया</Text>
          </View>
        )}
      </View>
      <Modal
        visible={fullscreen}
        animationType="fade"
        transparent={false}
        onRequestClose={() => setFullscreen(false)}>
        <View style={styles.fullscreenVideoBg}>
          <VideoView
            player={player}
            style={styles.fullscreenVideo}
            contentFit="contain"
            nativeControls={true}
            allowsFullscreen
          />
          <TouchableOpacity
            style={styles.fullscreenCloseBtn}
            onPress={() => setFullscreen(false)}>
            <Feather name="x" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

function ReelVideoCore({ uri, active, muted }) {
  const [videoError, setVideoError] = useState(null);
  const [ready, setReady] = useState(false);
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = muted;
  });
  const { status, error } = useEvent(player, 'statusChange', {
    status: 'idle',
    error: null,
  });

  useEffect(() => {
    if (error) setVideoError(error?.message);
  }, [error]);

  useEffect(() => {
    if (!player) return;
    try {
      player.muted = muted;
      if (active && status === 'readyToPlay') {
        player.play();
        setReady(true);
      } else if (!active) {
        player.pause();
        try {
          player.currentTime = 0;
        } catch {}
      }
    } catch (e) {
      console.log(e);
    }
  }, [active, muted, status, player]);

  return (
    <View style={styles.reelVideoWrap}>
      <VideoView
        player={player}
        style={styles.reelVideo}
        contentFit="cover"
        nativeControls={false}
      />
      {!ready && !videoError && (
        <View style={styles.reelLoading}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
      )}
      {videoError && (
        <View style={styles.reelLoading}>
          <Feather name="alert-circle" size={40} color="#fff" />
          <Text
            style={{
              color: '#fff',
              marginTop: 10,
              fontFamily: 'Poppins_400Regular',
            }}>
            Video play नहीं हुआ
          </Text>
        </View>
      )}
    </View>
  );
}

// ============================================
// MEDIA UPLOAD (fetch-based — SDK 54 safe)
// ============================================
async function pickAndUploadMedia(bucket, userId, mediaType = 'image') {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Gallery permission चाहिए।');
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: mediaType === 'video' ? ['videos'] : ['images'],
    allowsMultipleSelection: false,
    allowsEditing: mediaType === 'image',
    aspect: mediaType === 'image' ? [1, 1] : undefined,
    quality: 0.8,
    videoMaxDuration: mediaType === 'video' ? 60 : undefined,
  });
  if (result.canceled) return null;
  const asset = result.assets?.[0];
  if (!asset?.uri) throw new Error('Media select नहीं हुआ।');

  const response = await fetch(asset.uri);
  const arrayBuffer = await response.arrayBuffer();
  const sizeMB = arrayBuffer.byteLength / (1024 * 1024);
  if (mediaType === 'image' && sizeMB > 5)
    throw new Error('Image 5MB से छोटी होनी चाहिए।');
  if (mediaType === 'video' && sizeMB > 50)
    throw new Error('Video 50MB से छोटी होनी चाहिए।');

  let ext = mediaType === 'video' ? 'mp4' : 'jpg';
  if (asset.fileName) {
    const p = asset.fileName.split('.');
    if (p.length > 1) ext = p[p.length - 1];
  }
  ext = ext.toLowerCase();
  const ct =
    asset.mimeType || (mediaType === 'video' ? 'video/mp4' : 'image/jpeg');
  const path = `${userId}/${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}.${ext}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, arrayBuffer, { contentType: ct, upsert: false });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error('Public URL नहीं मिली।');
  return data.publicUrl;
}

// ============================================
// STORY RINGS
// ============================================
function StoryRings({ currentUserId, onOpenStory, onAddStory }) {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadStories = useCallback(async () => {
    const { data } = await supabase
      .from('stories')
      .select(
        'id,user_id,media_url,media_type,caption,expires_at,created_at,profiles(username,avatar_url,verification_status)'
      )
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    const grouped = {};
    (data || []).forEach((s) => {
      if (!grouped[s.user_id])
        grouped[s.user_id] = {
          user_id: s.user_id,
          profile: s.profiles,
          stories: [],
          latest: s.created_at,
        };
      grouped[s.user_id].stories.push(s);
    });
    setStories(
      Object.values(grouped).sort(
        (a, b) => new Date(b.latest) - new Date(a.latest)
      )
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    loadStories();
  }, [loadStories]);

  if (loading) return null;

  const myStory = stories.find((s) => s.user_id === currentUserId);
  const otherStories = stories.filter((s) => s.user_id !== currentUserId);

  const StoryCard = ({ group, isMine, onPress }) => {
    const firstStory = group?.stories?.[0];
    return (
      <TouchableOpacity
        style={styles.storyCard}
        onPress={onPress}
        activeOpacity={0.9}>
        {isMine && !myStory ? (
          <>
            <LinearGradient
              colors={['#1a1a1a', '#2a2a2a']}
              style={styles.storyCardBg}
            />
            <View style={styles.storyCreateIcon}>
              <Feather name="plus" size={24} color="#1877F2" />
            </View>
          </>
        ) : (
          <>
            <Image
              source={{ uri: firstStory?.media_url }}
              style={styles.storyCardBg}
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.75)']}
              style={styles.storyCardOverlay}
            />
            <View style={styles.storyCardAvatarRing}>
              <UserAvatar
                avatarUrl={group?.profile?.avatar_url}
                username={group?.profile?.username}
                size={36}
              />
            </View>
          </>
        )}
        <Text style={styles.storyCardName} numberOfLines={1}>
          {isMine && !myStory
            ? 'Create story'
            : group?.profile?.username || 'User'}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.storyContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 8,
          gap: 8,
          paddingVertical: 8,
        }}>
        <StoryCard
          isMine={true}
          group={myStory}
          onPress={myStory ? () => onOpenStory(myStory) : onAddStory}
        />
        {otherStories.map((s) => (
          <StoryCard key={s.user_id} group={s} onPress={() => onOpenStory(s)} />
        ))}
      </ScrollView>
    </View>
  );
}

// ============================================
// STORY VIEWER
// ============================================
function StoryViewer({ visible, storyGroup, onClose }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [storyGroup]);

  if (!storyGroup) return null;
  const current = storyGroup.stories[index];

  const next = () => {
    if (index < storyGroup.stories.length - 1) setIndex(index + 1);
    else onClose();
  };
  const prev = () => {
    if (index > 0) setIndex(index - 1);
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}>
      <View style={styles.storyViewerBg}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <View style={styles.storyProgressRow}>
            {storyGroup.stories.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.storyProgressBar,
                  i === index && { backgroundColor: '#fff' },
                ]}
              />
            ))}
          </View>
          <View style={styles.storyViewerHeader}>
            <UserAvatar
              avatarUrl={storyGroup.profile?.avatar_url}
              username={storyGroup.profile?.username}
              size={36}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.storyViewerName}>
                {storyGroup.profile?.username}
              </Text>
              {storyGroup.profile?.verification_status === 'verified' && (
                <VerifiedBadge size={13} />
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={{ marginLeft: 'auto' }}>
              <Feather name="x" size={26} color="#fff" />
            </TouchableOpacity>
          </View>
          {current?.media_type === 'video' ? (
            <PostVideoPlayer
              uri={current.media_url}
              shouldPlay={true}
              aspectRatio={16 / 9}
            />
          ) : (
            <Image
              source={{ uri: current?.media_url }}
              style={styles.storyViewerImage}
              resizeMode="contain"
            />
          )}
          {current?.caption ? (
            <Text style={styles.storyViewerCaption}>{current.caption}</Text>
          ) : null}
          <View style={styles.storyNavRow}>
            <TouchableOpacity style={styles.storyNavBtn} onPress={prev}>
              <Feather name="chevron-left" size={30} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.storyNavBtn} onPress={next}>
              <Feather name="chevron-right" size={30} color="#fff" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
// ============================================
// RIVO — Part 3 of 6 (FINAL)
// Comments Modal + PostCard + HomeScreen
// ============================================

// ============================================
// COMMENTS MODAL
// ============================================
function CommentsModal({ visible, postId, userId, onClose }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const loadComments = useCallback(async () => {
    if (!postId) return;
    const { data, error } = await supabase
      .from('comments')
      .select(
        'id,content,created_at,user_id,profiles(username,avatar_url,verification_status)'
      )
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    if (!error) setComments(data || []);
  }, [postId]);

  useEffect(() => {
    if (visible) loadComments();
  }, [visible, loadComments]);

  const addComment = async () => {
    if (!text.trim() || !userId || !postId) return;
    setLoading(true);
    const { error } = await supabase
      .from('comments')
      .insert({ post_id: postId, user_id: userId, content: text.trim() });
    setLoading(false);
    if (error) {
      Alert.alert('Comment', error.message);
      return;
    }
    const { data: postOwner } = await supabase
      .from('posts')
      .select('user_id')
      .eq('id', postId)
      .maybeSingle();
    if (postOwner?.user_id && postOwner.user_id !== userId) {
      await supabase.from('notifications').insert({
        user_id: postOwner.user_id,
        actor_id: userId,
        type: 'comment',
        post_id: postId,
        message: text.trim().substring(0, 50),
      });
    }
    setText('');
    loadComments();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.commentsSheet} edges={['top', 'bottom']}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Comments</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={comments}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ paddingBottom: 10 }}
            ListEmptyComponent={
              <Text style={styles.emptyText}>अभी कोई comment नहीं है।</Text>
            }
            renderItem={({ item }) => (
              <View style={styles.commentRow}>
                <UserAvatar
                  avatarUrl={item.profiles?.avatar_url}
                  username={item.profiles?.username}
                  size={35}
                />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.commentUser}>
                      {item.profiles?.username || 'User'}
                    </Text>
                    {item.profiles?.verification_status === 'verified' && (
                      <VerifiedBadge size={11} />
                    )}
                  </View>
                  <Text style={styles.commentText}>{item.content}</Text>
                </View>
              </View>
            )}
          />
          <View style={styles.commentInputRow}>
            <TextInput
              style={styles.commentInput}
              placeholder="Add a comment..."
              placeholderTextColor="#777"
              value={text}
              onChangeText={setText}
            />
            <TouchableOpacity
              style={styles.commentSend}
              onPress={addComment}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Feather name="send" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// ============================================
// POST CARD  (Photo Fullscreen + Video Fullscreen)
// ============================================
function PostCard({
  item,
  currentUserId,
  shouldPlay,
  onLike,
  onComment,
  onSave,
  isSaved,
  onUserPress,
  onShare,
  onDelete,
  onEdit,
  onReport,
  onView,
  viewCount,
}) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [photoFullscreen, setPhotoFullscreen] = useState(false);
  const [lastTap, setLastTap] = useState(0);
  const heartScale = useRef(new Animated.Value(0)).current;
  const viewedRef = useRef(false);

  const username = item.profiles?.username || 'User';
  const avatarUrl = item.profiles?.avatar_url;
  const isMine = item.user_id === currentUserId;

  useEffect(() => {
    if (!viewedRef.current && onView) {
      viewedRef.current = true;
      onView(item);
    }
  }, [onView, item]);

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap < 300) {
      if (!item.likedByMe) {
        onLike(item);
        Animated.sequence([
          Animated.spring(heartScale, {
            toValue: 1,
            friction: 3,
            tension: 200,
            useNativeDriver: true,
          }),
          Animated.timing(heartScale, {
            toValue: 0,
            duration: 250,
            delay: 700,
            useNativeDriver: true,
          }),
        ]).start();
      }
    }
    setLastTap(now);
  };

  return (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <TouchableOpacity onPress={() => onUserPress(item.user_id)}>
          <UserAvatar avatarUrl={avatarUrl} username={username} size={40} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.postUsername}>{username}</Text>
            {item.profiles?.verification_status === 'verified' && (
              <VerifiedBadge size={13} />
            )}
          </View>
          <Text style={styles.postDate}>{timeAgo(item.created_at)} • 🌍</Text>
        </View>
        <TouchableOpacity
          style={styles.moreButton}
          onPress={() => setMenuVisible(true)}>
          <Feather name="more-horizontal" size={22} color="#b0b3b8" />
        </TouchableOpacity>
      </View>

      {item.caption ? (
        <View style={styles.captionBox}>
          <Text style={styles.captionText}>{item.caption}</Text>
        </View>
      ) : null}

      <Pressable onPress={handleDoubleTap}>
        {item.media_type === 'video' ? (
          <PostVideoPlayer
            uri={item.media_url}
            shouldPlay={shouldPlay}
            aspectRatio={4 / 5}
          />
        ) : (
          <Pressable onPress={() => setPhotoFullscreen(true)}>
            <Image
              source={{ uri: item.media_url }}
              style={styles.postImage}
              resizeMode="cover"
            />
          </Pressable>
        )}
        <Animated.View
          style={[styles.heartPop, { transform: [{ scale: heartScale }] }]}>
          <Feather
            name="heart"
            size={80}
            color="#fff"
            style={{ textShadowColor: '#ff3040', textShadowRadius: 20 }}
          />
        </Animated.View>
      </Pressable>

      <View style={styles.postStats}>
        <View style={styles.likesRow}>
          <View style={styles.likeIconBg}>
            <Feather name="heart" size={12} color="#fff" fill="#fff" />
          </View>
          <Text style={styles.statsText}>{formatCount(item.likeCount)}</Text>
        </View>
        <Text style={styles.statsText}>
          {formatCount(item.commentCount)} comments •{' '}
          {formatCount(viewCount || 0)} views
        </Text>
      </View>

      <View style={styles.postDivider} />

      <View style={styles.postActions}>
        <TouchableOpacity onPress={() => onLike(item)} style={styles.actionBtn}>
          <Feather
            name="heart"
            size={22}
            color={item.likedByMe ? '#ff3040' : '#b0b3b8'}
            fill={item.likedByMe ? '#ff3040' : 'transparent'}
          />
          <Text
            style={[styles.actionText, item.likedByMe && { color: '#ff3040' }]}>
            Like
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onComment(item)}
          style={styles.actionBtn}>
          <Feather name="message-circle" size={22} color="#b0b3b8" />
          <Text style={styles.actionText}>Comment</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onShare(item)}
          style={styles.actionBtn}>
          <Feather name="share-2" size={22} color="#b0b3b8" />
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onSave(item)} style={styles.actionBtn}>
          <Feather
            name="bookmark"
            size={22}
            color={isSaved ? '#1877F2' : '#b0b3b8'}
            fill={isSaved ? '#1877F2' : 'transparent'}
          />
        </TouchableOpacity>
      </View>

      {/* PHOTO FULLSCREEN MODAL — presentationStyle हटाया गया ✅ */}
      <Modal
        visible={photoFullscreen}
        animationType="fade"
        transparent={false}
        onRequestClose={() => setPhotoFullscreen(false)}>
        <View style={styles.photoFullscreenBg}>
          <Image
            source={{ uri: item.media_url }}
            style={styles.photoFullscreenImage}
            resizeMode="contain"
          />
          <TouchableOpacity
            style={styles.photoFullscreenCloseBtn}
            onPress={() => setPhotoFullscreen(false)}>
            <Feather name="x" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>

      {/* POST MENU MODAL */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}>
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}>
          <View style={styles.menuSheet}>
            {isMine ? (
              <>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setMenuVisible(false);
                    onEdit(item);
                  }}>
                  <Feather name="edit-2" size={20} color="#fff" />
                  <Text style={styles.menuText}>Edit Caption</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setMenuVisible(false);
                    onDelete(item);
                  }}>
                  <Feather name="trash-2" size={20} color="#ff5c5c" />
                  <Text style={[styles.menuText, { color: '#ff5c5c' }]}>
                    Delete Post
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuVisible(false);
                  onReport(item);
                }}>
                <Feather name="flag" size={20} color="#ff5c5c" />
                <Text style={[styles.menuText, { color: '#ff5c5c' }]}>
                  Report Post
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setMenuVisible(false)}>
              <Feather name="x" size={20} color="#888" />
              <Text style={[styles.menuText, { color: '#888' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ============================================
// HOME SCREEN
// ============================================
function HomeScreen({
  userId,
  onCreate,
  onUserPress,
  onSharePost,
  onSearch,
  onChat,
  unreadChats,
  unreadNotifs,
}) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [commentPostId, setCommentPostId] = useState(null);
  const [savedPostIds, setSavedPostIds] = useState([]);
  const [viewsMap, setViewsMap] = useState({});
  const [storyViewerGroup, setStoryViewerGroup] = useState(null);
  const [myProfile, setMyProfile] = useState(null);

  const loadPosts = useCallback(async () => {
    const { data: blockedData } = await supabase
      .from('blocked_users')
      .select('blocked_id')
      .eq('blocker_id', userId);
    const blockedIds = (blockedData || []).map((b) => b.blocked_id);

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    setMyProfile(profileData);

    const { data, error } = await supabase
      .from('posts')
      .select(
        'id,user_id,media_url,thumbnail_url,media_type,caption,created_at,profiles(username,avatar_url,verification_status)'
      )
      .order('created_at', { ascending: false });

    if (error) {
      setLoading(false);
      return;
    }

    const basePosts = (data || []).filter(
      (p) => !blockedIds.includes(p.user_id)
    );
    const enriched = [];
    for (const post of basePosts) {
      const { count: likeCount } = await supabase
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', post.id);
      const { data: myLike } = await supabase
        .from('likes')
        .select('id')
        .eq('post_id', post.id)
        .eq('user_id', userId)
        .maybeSingle();
      const { count: commentCount } = await supabase
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', post.id);
      enriched.push({
        ...post,
        likeCount: likeCount || 0,
        commentCount: commentCount || 0,
        likedByMe: !!myLike,
      });
    }
    setPosts(enriched);

    const { data: savedData } = await supabase
      .from('saved_posts')
      .select('post_id')
      .eq('user_id', userId);
    setSavedPostIds((savedData || []).map((s) => s.post_id));

    const { data: viewData } = await supabase
      .from('post_views')
      .select('post_id');
    const vm = {};
    (viewData || []).forEach((v) => {
      vm[v.post_id] = (vm[v.post_id] || 0) + 1;
    });
    setViewsMap(vm);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const refresh = async () => {
    setRefreshing(true);
    await loadPosts();
    setRefreshing(false);
  };

  const toggleLike = async (item) => {
    const alreadyLiked = item.likedByMe;
    setPosts((old) =>
      old.map((p) =>
        p.id === item.id
          ? {
              ...p,
              likedByMe: !alreadyLiked,
              likeCount: Math.max(
                0,
                (p.likeCount || 0) + (alreadyLiked ? -1 : 1)
              ),
            }
          : p
      )
    );
    if (alreadyLiked) {
      await supabase
        .from('likes')
        .delete()
        .eq('post_id', item.id)
        .eq('user_id', userId);
    } else {
      await supabase
        .from('likes')
        .insert({ post_id: item.id, user_id: userId });
      if (item.user_id !== userId) {
        await supabase.from('notifications').insert({
          user_id: item.user_id,
          actor_id: userId,
          type: 'like',
          post_id: item.id,
        });
      }
    }
  };

  const toggleSave = async (item) => {
    const isSaved = savedPostIds.includes(item.id);
    if (isSaved) {
      setSavedPostIds((prev) => prev.filter((id) => id !== item.id));
      await supabase
        .from('saved_posts')
        .delete()
        .eq('user_id', userId)
        .eq('post_id', item.id);
    } else {
      setSavedPostIds((prev) => [...prev, item.id]);
      await supabase
        .from('saved_posts')
        .insert({ user_id: userId, post_id: item.id });
    }
  };

  const handleDeletePost = (post) => {
    Alert.alert('Delete Post', 'क्या delete करना है?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase
            .from('posts')
            .delete()
            .eq('id', post.id)
            .eq('user_id', userId);
          setPosts((prev) => prev.filter((p) => p.id !== post.id));
        },
      },
    ]);
  };

  const handleEditPost = (post) => {
    if (Platform.OS === 'ios' && Alert.prompt) {
      Alert.prompt(
        'Edit Caption',
        'नया caption',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save',
            onPress: async (t) => {
              await supabase
                .from('posts')
                .update({ caption: t?.trim() || null })
                .eq('id', post.id)
                .eq('user_id', userId);
              loadPosts();
            },
          },
        ],
        'plain-text',
        post.caption || ''
      );
    } else {
      Alert.alert('Edit', 'सिर्फ iOS पर available है।');
    }
  };

  const handleReportPost = (post) => {
    Alert.alert('Report Post', 'क्यों?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Spam', onPress: () => submitReport(post, 'Spam') },
      {
        text: 'Inappropriate',
        onPress: () => submitReport(post, 'Inappropriate'),
      },
      { text: 'Other', onPress: () => submitReport(post, 'Other') },
    ]);
  };

  const submitReport = async (post, reason) => {
    const { error } = await supabase
      .from('reports')
      .insert({ reporter_id: userId, post_id: post.id, reason });
    if (error) Alert.alert('Error', error.message);
    else Alert.alert('Rivo', 'Report submit हो गई। धन्यवाद!');
  };

  const handleViewPost = useCallback(
    async (post) => {
      const { data: existing } = await supabase
        .from('post_views')
        .select('id')
        .eq('post_id', post.id)
        .eq('user_id', userId)
        .maybeSingle();
      if (!existing)
        await supabase
          .from('post_views')
          .insert({ post_id: post.id, user_id: userId });
    },
    [userId]
  );

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 65 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    const f = viewableItems?.[0];
    if (f?.index != null) setActiveIndex(f.index);
  }).current;

  if (loading)
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator color="#1877F2" size="large" />
        <Text style={styles.loadingText}>Rivo loading...</Text>
      </View>
    );

  return (
    <SafeAreaView style={styles.mainScreen} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topIconLeft}>
          <Feather name="menu" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.brandText}>RIVO</Text>
        <View style={styles.topActions}>
          <TouchableOpacity onPress={onCreate} style={styles.topIcon}>
            <Feather name="plus-square" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onSearch} style={styles.topIcon}>
            <Feather name="search" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onChat} style={styles.topIcon}>
            <Feather name="message-circle" size={24} color="#fff" />
            {unreadChats > 0 && (
              <View style={styles.topIconBadge}>
                <Text style={styles.topIconBadgeText}>
                  {unreadChats > 9 ? '9+' : unreadChats}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={
          <>
            <StoryRings
              currentUserId={userId}
              onAddStory={() => onCreate()}
              onOpenStory={(g) => setStoryViewerGroup(g)}
            />
            <View style={styles.mindBar}>
              <UserAvatar
                avatarUrl={myProfile?.avatar_url}
                username={myProfile?.username}
                size={40}
              />
              <TouchableOpacity style={styles.mindInput} onPress={onCreate}>
                <Text style={styles.mindPlaceholder}>
                  What's on your mind?
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mindIconBtn} onPress={onCreate}>
                <Feather name="image" size={22} color="#45bd62" />
              </TouchableOpacity>
            </View>
            <View style={styles.mindActions}>
              <TouchableOpacity style={styles.mindAction} onPress={onCreate}>
                <Feather name="video" size={22} color="#f3425f" />
                <Text style={styles.mindActionText}>Live</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mindAction} onPress={onCreate}>
                <Feather name="image" size={22} color="#45bd62" />
                <Text style={styles.mindActionText}>Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mindAction} onPress={onCreate}>
                <Feather name="video" size={22} color="#7b2ff7" />
                <Text style={styles.mindActionText}>Reel</Text>
              </TouchableOpacity>
            </View>
          </>
        }
        renderItem={({ item, index }) => (
          <PostCard
            item={item}
            currentUserId={userId}
            shouldPlay={item.media_type === 'video' && index === activeIndex}
            onLike={toggleLike}
            onComment={(p) => setCommentPostId(p.id)}
            onSave={toggleSave}
            isSaved={savedPostIds.includes(item.id)}
            onUserPress={onUserPress}
            onShare={onSharePost}
            onDelete={handleDeletePost}
            onEdit={handleEditPost}
            onReport={handleReportPost}
            onView={handleViewPost}
            viewCount={viewsMap[item.id] || 0}
          />
        )}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor="#fff"
          />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="camera" size={55} color="#555" />
            <Text style={styles.emptyTitle}>No Posts Yet</Text>
            <Text style={styles.emptyText}>Create your first post</Text>
          </View>
        }
      />

      <CommentsModal
        visible={!!commentPostId}
        postId={commentPostId}
        userId={userId}
        onClose={() => setCommentPostId(null)}
      />
      <StoryViewer
        visible={!!storyViewerGroup}
        storyGroup={storyViewerGroup}
        onClose={() => setStoryViewerGroup(null)}
      />
    </SafeAreaView>
  );
}
// ============================================
// RIVO — Part 4 of 6 (FINAL)
// Friends + Reels + Marketplace + Notifications
// ============================================

// ============================================
// FRIENDS SCREEN
// ============================================
function FriendsScreen({ userId, onUserPress }) {
  const [activeTab, setActiveTab] = useState('suggestions');
  const [suggestions, setSuggestions] = useState([]);
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);

    const { data: myFollowing } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId);
    const followingIds = (myFollowing || []).map((f) => f.following_id);

    const { data: myFollowers } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('following_id', userId);
    const followerIds = (myFollowers || []).map((f) => f.follower_id);

    const mutualIds = followingIds.filter((id) => followerIds.includes(id));
    const { data: friendsData } = await supabase
      .from('profiles')
      .select('id,username,full_name,avatar_url,verification_status')
      .in(
        'id',
        mutualIds.length ? mutualIds : ['00000000-0000-0000-0000-000000000000']
      );
    setFriends(friendsData || []);

    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('id,username,full_name,avatar_url,verification_status')
      .neq('id', userId)
      .limit(30);
    const notFollowing = (allProfiles || [])
      .filter((p) => !followingIds.includes(p.id))
      .slice(0, 10);
    setSuggestions(notFollowing);

    const pendingIds = followerIds.filter((id) => !followingIds.includes(id));
    const { data: requestsData } = await supabase
      .from('profiles')
      .select('id,username,full_name,avatar_url,verification_status')
      .in(
        'id',
        pendingIds.length
          ? pendingIds
          : ['00000000-0000-0000-0000-000000000000']
      );
    setRequests(requestsData || []);

    setLoading(false);
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAdd = async (targetId) => {
    await supabase
      .from('follows')
      .insert({ follower_id: userId, following_id: targetId });
    await supabase
      .from('notifications')
      .insert({ user_id: targetId, actor_id: userId, type: 'follow' });
    setSuggestions((prev) => prev.filter((s) => s.id !== targetId));
  };

  const handleRemove = async (targetId) => {
    await supabase
      .from('follows')
      .delete()
      .eq('follower_id', userId)
      .eq('following_id', targetId);
    setSuggestions((prev) => prev.filter((s) => s.id !== targetId));
  };

  const handleConfirm = async (targetId) => {
    await supabase
      .from('follows')
      .insert({ follower_id: userId, following_id: targetId });
    await supabase
      .from('notifications')
      .insert({ user_id: targetId, actor_id: userId, type: 'follow' });
    setRequests((prev) => prev.filter((r) => r.id !== targetId));
    setFriends((prev) =>
      [...prev, requests.find((r) => r.id === targetId)].filter(Boolean)
    );
  };

  const handleRemoveFriend = (targetId) => {
    Alert.alert('Remove Friend', 'Remove करना है?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await supabase
            .from('follows')
            .delete()
            .eq('follower_id', userId)
            .eq('following_id', targetId);
          await supabase
            .from('follows')
            .delete()
            .eq('follower_id', targetId)
            .eq('following_id', userId);
          setFriends((p) => p.filter((f) => f.id !== targetId));
        },
      },
    ]);
  };

  const data =
    activeTab === 'suggestions'
      ? suggestions
      : activeTab === 'friends'
      ? friends
      : requests;

  return (
    <SafeAreaView style={styles.mainScreen} edges={['top']}>
      <ScreenHeader title="Friends" />

      <View style={styles.friendsTabs}>
        <TouchableOpacity
          style={[
            styles.friendsTab,
            activeTab === 'suggestions' && styles.friendsTabActive,
          ]}
          onPress={() => setActiveTab('suggestions')}>
          <Text
            style={[
              styles.friendsTabText,
              activeTab === 'suggestions' && styles.friendsTabTextActive,
            ]}>
            Suggestions
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.friendsTab,
            activeTab === 'friends' && styles.friendsTabActive,
          ]}
          onPress={() => setActiveTab('friends')}>
          <Text
            style={[
              styles.friendsTabText,
              activeTab === 'friends' && styles.friendsTabTextActive,
            ]}>
            Your Friends
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.friendsTab,
            activeTab === 'requests' && styles.friendsTabActive,
          ]}
          onPress={() => setActiveTab('requests')}>
          <Text
            style={[
              styles.friendsTabText,
              activeTab === 'requests' && styles.friendsTabTextActive,
            ]}>
            Requests
          </Text>
          {requests.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{requests.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerScreen}>
          <ActivityIndicator color="#1877F2" size="large" />
        </View>
      ) : data.length === 0 ? (
        <View style={styles.centerScreen}>
          <Feather name="users" size={55} color="#555" />
          <Text style={styles.emptyTitle}>
            {activeTab === 'suggestions'
              ? 'कोई suggestion नहीं'
              : activeTab === 'friends'
              ? 'कोई friend नहीं'
              : 'कोई request नहीं'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isSuggestionTab = activeTab === 'suggestions';
            const isFriendsTab = activeTab === 'friends';
            const isRequestsTab = activeTab === 'requests';

            return (
              <View style={styles.friendRow}>
                <TouchableOpacity onPress={() => onUserPress(item.id)}>
                  <UserAvatar
                    avatarUrl={item.avatar_url}
                    username={item.username}
                    size={64}
                  />
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <TouchableOpacity
                    onPress={() => onUserPress(item.id)}
                    style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.friendName}>{item.username}</Text>
                    {item.verification_status === 'verified' && (
                      <VerifiedBadge size={13} />
                    )}
                  </TouchableOpacity>
                  <Text style={styles.friendMutual}>
                    {isSuggestionTab
                      ? 'Suggested for you'
                      : isFriendsTab
                      ? 'Friend'
                      : 'Wants to follow you'}
                  </Text>
                </View>

                {isRequestsTab ? (
                  <View style={styles.friendActionRow}>
                    <TouchableOpacity
                      style={styles.confirmBtn}
                      onPress={() => handleConfirm(item.id)}>
                      <Text style={styles.confirmBtnText}>Confirm</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() =>
                        setRequests((p) => p.filter((r) => r.id !== item.id))
                      }>
                      <Text style={styles.deleteBtnText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                ) : isFriendsTab ? (
                  <View style={styles.friendActionRow}>
                    <TouchableOpacity
                      style={styles.confirmBtn}
                      onPress={() => onUserPress(item.id)}>
                      <Feather name="message-circle" size={14} color="#fff" />
                      <Text style={styles.confirmBtnText}> View</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleRemoveFriend(item.id)}>
                      <Text style={styles.deleteBtnText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.friendActionRow}>
                    <TouchableOpacity
                      style={styles.addFriendBtn}
                      onPress={() => handleAdd(item.id)}>
                      <Text style={styles.addFriendBtnText}>Add Friend</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => handleRemove(item.id)}>
                      <Text style={styles.removeBtnText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

// ============================================
// REELS SCREEN
// ============================================
function ReelsScreen({ userId }) {
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(false);
  const [likedReels, setLikedReels] = useState({});
  const [likeCounts, setLikeCounts] = useState({});
  const [commentCounts, setCommentCounts] = useState({});
  const [followedUsers, setFollowedUsers] = useState({});
  const [commentReelId, setCommentReelId] = useState(null);

  const loadReels = useCallback(async () => {
    const { data } = await supabase
      .from('posts')
      .select(
        'id,user_id,media_url,media_type,caption,created_at,profiles(id,username,avatar_url,verification_status)'
      )
      .eq('media_type', 'video')
      .order('created_at', { ascending: false })
      .limit(30);
    const reelsData = data || [];
    setReels(reelsData);

    if (!reelsData.length) {
      setLoading(false);
      return;
    }
    const ids = reelsData.map((r) => r.id);
    const [likesRes, commentsRes, myLikesRes, followsRes] = await Promise.all([
      supabase.from('likes').select('post_id').in('post_id', ids),
      supabase.from('comments').select('post_id').in('post_id', ids),
      supabase
        .from('likes')
        .select('post_id')
        .in('post_id', ids)
        .eq('user_id', userId),
      supabase.from('follows').select('following_id').eq('follower_id', userId),
    ]);
    const lc = {},
      cc = {},
      liked = {},
      followed = {};
    (likesRes.data || []).forEach((l) => {
      lc[l.post_id] = (lc[l.post_id] || 0) + 1;
    });
    (commentsRes.data || []).forEach((c) => {
      cc[c.post_id] = (cc[c.post_id] || 0) + 1;
    });
    (myLikesRes.data || []).forEach((l) => {
      liked[l.post_id] = true;
    });
    (followsRes.data || []).forEach((f) => {
      followed[f.following_id] = true;
    });
    setLikeCounts(lc);
    setCommentCounts(cc);
    setLikedReels(liked);
    setFollowedUsers(followed);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    loadReels();
  }, [loadReels]);

  const toggleLike = async (reel) => {
    const isLiked = likedReels[reel.id];
    setLikedReels((p) => ({ ...p, [reel.id]: !isLiked }));
    setLikeCounts((p) => ({
      ...p,
      [reel.id]: Math.max(0, (p[reel.id] || 0) + (isLiked ? -1 : 1)),
    }));
    if (isLiked)
      await supabase
        .from('likes')
        .delete()
        .eq('post_id', reel.id)
        .eq('user_id', userId);
    else {
      await supabase
        .from('likes')
        .insert({ post_id: reel.id, user_id: userId });
      if (reel.user_id !== userId)
        await supabase.from('notifications').insert({
          user_id: reel.user_id,
          actor_id: userId,
          type: 'like',
          post_id: reel.id,
        });
    }
  };

  const toggleFollow = async (reelUserId) => {
    const isFollowed = followedUsers[reelUserId];
    setFollowedUsers((p) => ({ ...p, [reelUserId]: !isFollowed }));
    if (isFollowed)
      await supabase
        .from('follows')
        .delete()
        .eq('follower_id', userId)
        .eq('following_id', reelUserId);
    else {
      await supabase
        .from('follows')
        .insert({ follower_id: userId, following_id: reelUserId });
      await supabase
        .from('notifications')
        .insert({ user_id: reelUserId, actor_id: userId, type: 'follow' });
    }
  };

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 70 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    const f = viewableItems?.[0];
    if (f?.index != null) setActiveIndex(f.index);
  }).current;

  if (loading)
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  if (reels.length === 0)
    return (
      <SafeAreaView style={styles.reelsScreen} edges={['top']}>
        <View style={styles.centerScreen}>
          <Feather name="video" size={60} color="#777" />
          <Text style={styles.emptyTitle}>No Reels Yet</Text>
        </View>
      </SafeAreaView>
    );

  return (
    <View style={styles.reelsScreen}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <FlatList
          data={reels}
          keyExtractor={(item) => String(item.id)}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          snapToAlignment="start"
          renderItem={({ item, index }) => {
            const isActive = index === activeIndex;
            const isLiked = likedReels[item.id];
            const isFollowed = followedUsers[item.user_id];
            const isMe = item.user_id === userId;
            return (
              <View style={styles.reelItem} key={item.id}>
                <ReelVideoCore
                  key={item.id}
                  uri={item.media_url}
                  active={isActive}
                  muted={muted}
                />

                <View style={styles.reelTopBar} pointerEvents="box-none">
                  <View style={styles.reelTopLeft}>
                    <UserAvatar
                      avatarUrl={item.profiles?.avatar_url}
                      username={item.profiles?.username}
                      size={40}
                    />
                    <View style={{ marginLeft: 10 }}>
                      <View
                        style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text
                          style={styles.reelTopUsername}
                          numberOfLines={1}>
                          {item.profiles?.username || 'User'}
                        </Text>
                        {item.profiles?.verification_status === 'verified' && (
                          <VerifiedBadge size={12} />
                        )}
                      </View>
                      <Text style={styles.reelTopSubtitle}>Original audio</Text>
                    </View>
                  </View>
                  <View style={styles.reelTopRight}>
                    {!isMe && (
                      <TouchableOpacity
                        style={[
                          styles.reelFollowBtn,
                          isFollowed && styles.reelFollowBtnActive,
                        ]}
                        onPress={() => toggleFollow(item.user_id)}>
                        <Text style={styles.reelFollowBtnText}>
                          {isFollowed ? 'Following' : 'Follow'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                <View style={styles.reelBottomLeft} pointerEvents="box-none">
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      marginBottom: 6,
                    }}>
                    <Text style={styles.reelCaptionUsername}>
                      {item.profiles?.username || 'User'}
                    </Text>
                    {item.profiles?.verification_status === 'verified' && (
                      <VerifiedBadge size={12} />
                    )}
                  </View>
                  {!!item.caption && (
                    <Text style={styles.reelCaptionText} numberOfLines={2}>
                      {item.caption}
                    </Text>
                  )}
                </View>

                <View
                  style={styles.reelActionsColumn}
                  pointerEvents="box-none">
                  <TouchableOpacity
                    style={styles.reelActionBtn}
                    onPress={() => toggleLike(item)}>
                    <Feather
                      name="heart"
                      size={32}
                      color={isLiked ? '#ff3040' : '#fff'}
                      fill={isLiked ? '#ff3040' : 'transparent'}
                    />
                    <Text style={styles.reelActionCount}>
                      {formatCount(likeCounts[item.id] || 0)}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.reelActionBtn}
                    onPress={() => setCommentReelId(item.id)}>
                    <Feather name="message-circle" size={30} color="#fff" />
                    <Text style={styles.reelActionCount}>
                      {formatCount(commentCounts[item.id] || 0)}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.reelActionBtn}
                    onPress={() => {}}>
                    <Feather name="send" size={28} color="#fff" />
                    <Text style={styles.reelActionCount}>Share</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.reelActionBtn}
                    onPress={() => {}}>
                    <Feather name="bookmark" size={28} color="#fff" />
                    <Text style={styles.reelActionCount}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.reelActionBtn}
                    onPress={() => setMuted((v) => !v)}>
                    <Feather
                      name={muted ? 'volume-x' : 'volume-2'}
                      size={26}
                      color="#fff"
                    />
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
        />
      </SafeAreaView>
      <CommentsModal
        visible={!!commentReelId}
        postId={commentReelId}
        userId={userId}
        onClose={() => setCommentReelId(null)}
      />
    </View>
  );
}

// ============================================
// MARKETPLACE SCREEN
// ============================================
const MARKETPLACE_CATEGORIES = [
  { key: 'all', label: 'All', icon: 'grid' },
  { key: 'electronics', label: 'Electronics', icon: 'smartphone' },
  { key: 'clothes', label: 'Clothes', icon: 'shopping-bag' },
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'vehicles', label: 'Vehicles', icon: 'truck' },
];

const SAMPLE_PRODUCTS = [
  {
    id: 1,
    title: 'iPhone 14',
    price: 45000,
    category: 'electronics',
    location: 'Used',
    img: 'https://images.unsplash.com/photo-1592286927505-1def25115558?w=400',
  },
  {
    id: 2,
    title: 'Royal Enfield Classic 350',
    price: 175000,
    category: 'vehicles',
    location: 'Used',
    img: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=400',
  },
  {
    id: 3,
    title: '2 BHK Flat for Rent',
    price: 12000,
    category: 'home',
    location: 'Per month',
    img: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400',
  },
  {
    id: 4,
    title: 'Boat Headphones',
    price: 1999,
    category: 'electronics',
    location: 'New',
    img: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400',
  },
  {
    id: 5,
    title: 'Cotton T-Shirt',
    price: 499,
    category: 'clothes',
    location: 'New',
    img: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400',
  },
  {
    id: 6,
    title: 'Wooden Sofa Set',
    price: 25000,
    category: 'home',
    location: 'Used',
    img: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400',
  },
];

function MarketplaceScreen() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [filter, setFilter] = useState('all');

  const filtered = SAMPLE_PRODUCTS.filter((p) => {
    if (activeCategory !== 'all' && p.category !== activeCategory) return false;
    return true;
  });

  return (
    <SafeAreaView style={styles.mainScreen} edges={['top']}>
      <ScreenHeader title="Marketplace" />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 12,
          gap: 10,
          paddingVertical: 12,
        }}>
        {MARKETPLACE_CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c.key}
            style={[
              styles.categoryItem,
              activeCategory === c.key && styles.categoryItemActive,
            ]}
            onPress={() => setActiveCategory(c.key)}>
            <View
              style={[
                styles.categoryIcon,
                activeCategory === c.key && styles.categoryIconActive,
              ]}>
              <Feather
                name={c.icon}
                size={20}
                color={activeCategory === c.key ? '#fff' : '#1877F2'}
              />
            </View>
            <Text
              style={[
                styles.categoryLabel,
                activeCategory === c.key && styles.categoryLabelActive,
              ]}>
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.marketFilters}>
        {['all', 'sale', 'rent', 'jobs'].map((f) => (
          <TouchableOpacity
            key={f}
            style={[
              styles.marketFilter,
              filter === f && styles.marketFilterActive,
            ]}
            onPress={() => setFilter(f)}>
            <Text
              style={[
                styles.marketFilterText,
                filter === f && styles.marketFilterTextActive,
              ]}>
              {f === 'all'
                ? 'All'
                : f === 'sale'
                ? 'For Sale'
                : f === 'rent'
                ? 'For Rent'
                : 'Jobs'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        columnWrapperStyle={{ gap: 8, paddingHorizontal: 8 }}
        contentContainerStyle={{ paddingVertical: 8, gap: 8 }}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.productCard} activeOpacity={0.9}>
            <Image source={{ uri: item.img }} style={styles.productImage} />
            <View style={styles.productInfo}>
              <Text style={styles.productTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.productPrice}>{formatPrice(item.price)}</Text>
              <Text style={styles.productLocation}>{item.location}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

// ============================================
// NOTIFICATIONS SCREEN
// ============================================
function NotificationsScreen({ currentUserId, onUserPress }) {
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*, actor:actor_id(id, username, avatar_url)')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false })
      .limit(100);
    setNotifs(data || []);
    setLoading(false);
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', currentUserId)
      .eq('is_read', false);
  };

  useEffect(() => {
    load();
  }, [currentUserId]);

  const renderText = (n) => {
    switch (n.type) {
      case 'like':
        return 'liked your post';
      case 'comment':
        return 'commented on your post';
      case 'follow':
        return 'started following you';
      default:
        return 'interacted with you';
    }
  };

  const renderIcon = (type) => {
    const map = {
      like: { name: 'heart', color: '#f3425f' },
      comment: { name: 'message-circle', color: '#1877F2' },
      follow: { name: 'user-plus', color: '#00c2ff' },
    };
    const it = map[type] || { name: 'bell', color: '#888' };
    return <Feather name={it.name} size={12} color="#fff" />;
  };

  const renderIconBg = (type) => {
    const map = { like: '#f3425f', comment: '#1877F2', follow: '#00c2ff' };
    return map[type] || '#888';
  };

  return (
    <SafeAreaView style={styles.mainScreen} edges={['top']}>
      <ScreenHeader title="Notifications" />
      {loading ? (
        <View style={styles.centerScreen}>
          <ActivityIndicator color="#1877F2" size="large" />
        </View>
      ) : notifs.length === 0 ? (
        <View style={styles.centerScreen}>
          <Feather name="bell-off" size={55} color="#555" />
          <Text style={styles.emptyTitle}>No Notifications</Text>
        </View>
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={(i) => String(i.id)}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.notifRow, !item.is_read && styles.notifRowUnread]}
              onPress={() => item.actor?.id && onUserPress(item.actor.id)}
              activeOpacity={0.7}>
              <View style={{ position: 'relative' }}>
                <UserAvatar
                  avatarUrl={item.actor?.avatar_url}
                  username={item.actor?.username}
                  size={56}
                />
                <View
                  style={[
                    styles.notifIconBadge,
                    { backgroundColor: renderIconBg(item.type) },
                  ]}>
                  {renderIcon(item.type)}
                </View>
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.notifText}>
                  <Text style={styles.notifUsername}>
                    {item.actor?.username || 'User'}
                  </Text>{' '}
                  <Text style={{ color: '#b0b3b8' }}>{renderText(item)}</Text>
                </Text>
                <Text
                  style={[
                    styles.notifTime,
                    !item.is_read && { color: '#1877F2', fontWeight: '700' },
                  ]}>
                  {timeAgo(item.created_at)} ago
                </Text>
              </View>
              {!item.is_read && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}
// ============================================
// RIVO — Part 5 of 6 (FINAL)
// Menu + Create/Share Modal + Post Preview + NewReel + Chat
// ============================================

// ============================================
// MENU SCREEN
// ============================================
function MenuScreen({ userId, onUserPress, onLogout }) {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({ friends: 0 });

  useEffect(() => {
    (async () => {
      const { data: p } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      setProfile(p);
      const { count: friends } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', userId);
      setStats({ friends: friends || 0 });
    })();
  }, [userId]);

  const MenuItem = ({ icon, label, onPress, color = '#fff', badge }) => (
    <TouchableOpacity style={styles.menuRow} onPress={onPress}>
      <View style={styles.menuIconWrap}>
        <Feather name={icon} size={22} color={color} />
      </View>
      <Text style={[styles.menuRowText, { color }]}>{label}</Text>
      {badge ? (
        <View style={styles.menuBadge}>
          <Text style={styles.menuBadgeText}>{badge}</Text>
        </View>
      ) : null}
      <Feather name="chevron-right" size={20} color="#555" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.mainScreen} edges={['top']}>
      <ScreenHeader title="Menu" />
      <ScrollView showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.menuProfile}
          onPress={() => onUserPress(userId)}>
          <UserAvatar
            avatarUrl={profile?.avatar_url}
            username={profile?.username}
            size={52}
          />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.menuProfileName}>
              {profile?.username || 'User'}
            </Text>
            <Text style={styles.menuProfileSub}>View your profile</Text>
          </View>
          <Feather name="chevron-right" size={20} color="#888" />
        </TouchableOpacity>

        <View style={styles.menuDivider} />

        <MenuItem
          icon="users"
          label="Friends"
          badge={stats.friends}
          onPress={() => {}}
        />
        <MenuItem icon="grid" label="Groups" onPress={() => {}} />
        <MenuItem icon="shopping-bag" label="Marketplace" onPress={() => {}} />
        <MenuItem icon="play-circle" label="Watch" onPress={() => {}} />
        <MenuItem icon="calendar" label="Events" onPress={() => {}} />
        <MenuItem icon="clock" label="Memories" onPress={() => {}} />
        <MenuItem icon="bookmark" label="Saved" onPress={() => {}} />
        <MenuItem icon="flag" label="Pages" onPress={() => {}} />

        <View style={styles.menuDivider} />

        <MenuItem
          icon="help-circle"
          label="Help & Support"
          onPress={() => {}}
        />
        <MenuItem
          icon="settings"
          label="Settings & Privacy"
          onPress={() => {}}
        />
        <MenuItem
          icon="log-out"
          label="Log Out"
          color="#ff5c5c"
          onPress={onLogout}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================
// POST PREVIEW MODAL (before upload)
// ============================================
function PostPreviewModal({ visible, asset, userId, onClose, onPosted }) {
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (visible) setCaption('');
  }, [visible]);

  if (!asset) return null;
  const isVideo = asset.type === 'video';

  const upload = async () => {
    setUploading(true);
    try {
      const response = await fetch(asset.uri);
      const arrayBuffer = await response.arrayBuffer();
      const sizeMB = arrayBuffer.byteLength / (1024 * 1024);

      if (!isVideo && sizeMB > 5)
        throw new Error('Image 5MB से छोटी होनी चाहिए।');
      if (isVideo && sizeMB > 50)
        throw new Error('Video 50MB से छोटी होनी चाहिए।');

      let ext = isVideo ? 'mp4' : 'jpg';
      if (asset.fileName) {
        const p = asset.fileName.split('.');
        if (p.length > 1) ext = p[p.length - 1];
      }
      ext = ext.toLowerCase();
      const ct = asset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg');
      const path = `${userId}/${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}.${ext}`;

      const { error } = await supabase.storage
        .from('posts')
        .upload(path, arrayBuffer, { contentType: ct, upsert: false });
      if (error) throw new Error(error.message);

      const { data } = supabase.storage.from('posts').getPublicUrl(path);

      const { error: postErr } = await supabase.from('posts').insert({
        user_id: userId,
        media_url: data.publicUrl,
        media_type: asset.type,
        caption: caption.trim() || null,
      });
      if (postErr) throw new Error(postErr.message);

      setUploading(false);
      onClose();
      if (onPosted) onPosted();
      Alert.alert('Rivo', isVideo ? '🎬 Video posted!' : '📸 Photo posted!');
    } catch (e) {
      setUploading(false);
      Alert.alert('Upload failed', e?.message || 'Upload नहीं हुआ।');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}>
      <SafeAreaView style={styles.previewScreen} edges={['top', 'bottom']}>
        <View style={styles.previewHeader}>
          <TouchableOpacity onPress={onClose} style={styles.screenHeaderBtn}>
            <Feather name="x" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.previewHeaderTitle}>New Post</Text>
          <TouchableOpacity
            onPress={upload}
            disabled={uploading}
            style={styles.previewPostBtn}>
            {uploading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.previewPostBtnText}>Post</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.previewMediaWrap}>
          {isVideo ? (
            <VideoView
              player={useVideoPlayer(asset.uri, (p) => {
                p.loop = true;
                p.muted = false;
                p.play();
              })}
              style={styles.previewMedia}
              contentFit="contain"
              nativeControls={true}
            />
          ) : (
            <Image
              source={{ uri: asset.uri }}
              style={styles.previewMedia}
              resizeMode="contain"
            />
          )}
        </View>

        <View style={styles.previewCaptionWrap}>
          <TextInput
            style={styles.previewCaptionInput}
            placeholder="Write a caption..."
            placeholderTextColor="#888"
            value={caption}
            onChangeText={setCaption}
            multiline
            maxLength={2200}
          />
          <Text style={styles.previewCaptionCounter}>
            {caption.length}/2200
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ============================================
// CREATE MODAL
// ============================================
function CreateModal({
  visible,
  onClose,
  userId,
  onCreated,
  onOpenCamera,
  onOpenReel,
}) {
  const [uploading, setUploading] = useState(false);
  const [previewAsset, setPreviewAsset] = useState(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  const pickForPreview = async (mediaType) => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Rivo', 'Gallery permission चाहिए।');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: mediaType === 'video' ? ['videos'] : ['images'],
        allowsMultipleSelection: false,
        allowsEditing: mediaType === 'image',
        aspect: mediaType === 'image' ? [1, 1] : undefined,
        quality: 0.8,
        videoMaxDuration: mediaType === 'video' ? 60 : undefined,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      setPreviewAsset({
        uri: asset.uri,
        type: mediaType,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
      });
      onClose();
      setTimeout(() => setPreviewVisible(true), 300);
    } catch (e) {
      Alert.alert('Error', e?.message);
    }
  };

  const addStory = async () => {
    try {
      setUploading(true);
      const url = await pickAndUploadMedia('posts', userId, 'image');
      if (!url) {
        setUploading(false);
        return;
      }
      await supabase.from('stories').insert({
        user_id: userId,
        media_url: url,
        media_type: 'image',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      setUploading(false);
      onClose();
      if (onCreated) onCreated();
      Alert.alert('Rivo', 'Story posted!');
    } catch (e) {
      setUploading(false);
      Alert.alert('Error', e?.message);
    }
  };

  const openCamera = () => {
    onClose();
    setTimeout(() => onOpenCamera(''), 300);
  };
  const openReel = () => {
    onClose();
    setTimeout(() => onOpenReel && onOpenReel(), 300);
  };

  const Option = ({ icon, title, subtitle, gradient, onPress, badge }) => (
    <TouchableOpacity style={styles.createRow} onPress={onPress}>
      <LinearGradient colors={gradient} style={styles.createRowIcon}>
        <Feather name={icon} size={22} color="#fff" />
      </LinearGradient>
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={styles.createRowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.createRowSub}>{subtitle}</Text> : null}
      </View>
      {badge ? (
        <View style={styles.createNewBadge}>
          <Text style={styles.createNewBadgeText}>{badge}</Text>
        </View>
      ) : null}
      <Feather name="chevron-right" size={20} color="#555" />
    </TouchableOpacity>
  );

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={onClose}>
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.createSheetBig} edges={['bottom']}>
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }} />
              <Text style={styles.sheetTitle}>Create</Text>
              <TouchableOpacity
                onPress={onClose}
                style={{ flex: 1, alignItems: 'flex-end' }}>
                <Feather name="x" size={25} color="#fff" />
              </TouchableOpacity>
            </View>
            {uploading ? (
              <View style={styles.uploadingBox}>
                <ActivityIndicator color="#1877F2" size="large" />
                <Text style={styles.uploadingText}>Uploading...</Text>
              </View>
            ) : (
              <ScrollView
                style={{ maxHeight: SCREEN_HEIGHT * 0.7 }}
                showsVerticalScrollIndicator={false}>
                <Option
                  icon="video"
                  title="Reel"
                  subtitle="Short video"
                  gradient={['#7b2ff7', '#e0218a']}
                  onPress={openReel}
                />
                <Option
                  icon="scissors"
                  title="Edits"
                  subtitle="Video edit करें"
                  badge="New"
                  gradient={['#e0218a', '#ff8a00']}
                  onPress={() => Alert.alert('Edits', 'Coming soon!')}
                />
                <Option
                  icon="grid"
                  title="Post"
                  subtitle="Photo gallery से"
                  gradient={['#e0218a', '#ff8a00']}
                  onPress={() => pickForPreview('image')}
                />
                <Option
                  icon="video"
                  title="Video"
                  subtitle="Video gallery से"
                  gradient={['#7b2ff7', '#e0218a']}
                  onPress={() => pickForPreview('video')}
                />
                <Option
                  icon="camera"
                  title="Camera"
                  subtitle="Capture"
                  gradient={['#7b2ff7', '#e0218a']}
                  onPress={openCamera}
                />
                <Option
                  icon="circle"
                  title="Story"
                  subtitle="24 hours"
                  gradient={['#e0218a', '#7b2ff7']}
                  onPress={addStory}
                />
                <Option
                  icon="radio"
                  title="Live"
                  subtitle="Live stream"
                  badge="Soon"
                  gradient={['#ff3040', '#e0218a']}
                  onPress={() => Alert.alert('Live', 'Coming soon!')}
                />
              </ScrollView>
            )}
          </SafeAreaView>
        </View>
      </Modal>

      <PostPreviewModal
        visible={previewVisible}
        asset={previewAsset}
        userId={userId}
        onClose={() => {
          setPreviewVisible(false);
          setPreviewAsset(null);
        }}
        onPosted={() => {
          setPreviewVisible(false);
          setPreviewAsset(null);
          if (onCreated) onCreated();
        }}
      />
    </>
  );
}

// ============================================
// SHARE MODAL
// ============================================
function ShareModal({ visible, post, currentUserId, onClose }) {
  if (!post) return null;
  const shareLink = `rivo.app/post/${post.id}`;
  const copyLink = () => {
    Alert.alert('Link Copied', shareLink);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.createSheet} edges={['bottom']}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Share Post</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={25} color="#fff" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.createOption} onPress={copyLink}>
            <View style={[styles.createIcon, { backgroundColor: '#333' }]}>
              <Feather name="link" size={24} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.createOptionTitle}>Copy Link</Text>
            </View>
            <Feather name="copy" size={20} color="#777" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.createOption} onPress={copyLink}>
            <LinearGradient
              colors={['#25D366', '#128C7E']}
              style={styles.createIcon}>
              <Feather name="share-2" size={25} color="#fff" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.createOptionTitle}>Share externally</Text>
            </View>
            <Feather name="external-link" size={20} color="#777" />
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// ============================================
// NEW REEL SCREEN
// ============================================
function NewReelScreen({ videoUri, onBack, onShare, uploading }) {
  const [caption, setCaption] = useState('');
  const player = useVideoPlayer(videoUri, (p) => {
    p.loop = true;
    p.muted = false;
    p.play();
  });

  return (
    <SafeAreaView style={styles.mainScreen} edges={['top', 'bottom']}>
      <ScreenHeader title="New Reel" onBack={onBack} />
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.nrPreviewWrap}>
          <View style={styles.nrPreviewCard}>
            <View style={styles.nrPreviewVideo}>
              <VideoView
                player={player}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                nativeControls={false}
              />
            </View>
            <View style={styles.nrCaptionBox}>
              <TextInput
                style={styles.nrCaptionInput}
                placeholder="Write a caption..."
                placeholderTextColor="#777"
                value={caption}
                onChangeText={setCaption}
                multiline
                maxLength={2200}
              />
              <Text style={styles.nrCaptionCounter}>
                {caption.length}/2200
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
      <View style={styles.nrBottomBar}>
        <TouchableOpacity
          style={[styles.nrShareBtn, uploading && { opacity: 0.6 }]}
          onPress={() => {
            if (!caption.trim()) {
              Alert.alert('Rivo', '💡 Caption लिखो!');
              return;
            }
            onShare(caption.trim());
          }}
          disabled={uploading}>
          {uploading ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.nrShareBtnText}> Uploading...</Text>
            </>
          ) : (
            <>
              <Feather name="send" size={18} color="#fff" />
              <Text style={styles.nrShareBtnText}> SHARE REEL</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ============================================
// CHAT LIST SCREEN
// ============================================
function ChatListScreen({ userId, onOpenChat, onUserPress }) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadChats = useCallback(async () => {
    setLoading(true);
    const { data: myChats } = await supabase
      .from('chat_participants')
      .select('chat_id')
      .eq('user_id', userId);
    const chatIds = (myChats || []).map((c) => c.chat_id);

    if (!chatIds.length) {
      setChats([]);
      setLoading(false);
      return;
    }

    const { data: chatsData } = await supabase
      .from('chats')
      .select('id,last_message,last_message_at')
      .in('id', chatIds)
      .order('last_message_at', { ascending: false });

    const enriched = [];
    for (const chat of chatsData || []) {
      const { data: participants } = await supabase
        .from('chat_participants')
        .select(
          'user_id,profiles:user_id(username,avatar_url,verification_status)'
        )
        .eq('chat_id', chat.id);
      const other = (participants || []).find((p) => p.user_id !== userId);
      if (other)
        enriched.push({
          ...chat,
          other: other.profiles,
          otherId: other.user_id,
        });
    }
    setChats(enriched);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    loadChats();
    const ch = supabase
      .channel(`chatlist-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chats' },
        loadChats
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [loadChats, userId]);

  return (
    <SafeAreaView style={styles.mainScreen} edges={['top']}>
      <ScreenHeader title="Chats" />
      {loading ? (
        <View style={styles.centerScreen}>
          <ActivityIndicator color="#1877F2" size="large" />
        </View>
      ) : chats.length === 0 ? (
        <View style={styles.centerScreen}>
          <Feather name="message-circle" size={55} color="#555" />
          <Text style={styles.emptyTitle}>No Chats Yet</Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(i) => String(i.id)}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.chatListItem}
              onPress={() =>
                onOpenChat({
                  chatId: item.id,
                  otherId: item.otherId,
                  otherName: item.other?.username,
                  otherAvatar: item.other?.avatar_url,
                })
              }>
              <UserAvatar
                avatarUrl={item.other?.avatar_url}
                username={item.other?.username}
                size={56}
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.chatListName}>
                    {item.other?.username || 'User'}
                  </Text>
                  {item.other?.verification_status === 'verified' && (
                    <VerifiedBadge size={12} />
                  )}
                </View>
                <Text style={styles.chatListLast} numberOfLines={1}>
                  {item.last_message || 'Tap to chat'}
                </Text>
              </View>
              <Text style={{ color: '#777', fontSize: 11 }}>
                {timeAgo(item.last_message_at)}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

// ============================================
// CHAT ROOM SCREEN
// ============================================
function ChatRoomScreen({ chatInfo, userId, onBack }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const loadMessages = useCallback(async () => {
    if (!chatInfo?.chatId) return;
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatInfo.chatId)
      .order('created_at', { ascending: true });
    setMessages(data || []);
  }, [chatInfo]);

  useEffect(() => {
    loadMessages();
    if (!chatInfo?.chatId) return;
    const ch = supabase
      .channel(`chat-${chatInfo.chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatInfo.chatId}`,
        },
        (payload) => setMessages((prev) => [...prev, payload.new])
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [chatInfo, loadMessages]);

  const send = async () => {
    if (!text.trim() || !chatInfo?.chatId) return;
    setSending(true);
    const msg = text.trim();
    setText('');
    await supabase.from('messages').insert({
      chat_id: chatInfo.chatId,
      sender_id: userId,
      content: msg,
    });
    await supabase
      .from('chats')
      .update({
        last_message: msg,
        last_message_at: new Date().toISOString(),
      })
      .eq('id', chatInfo.chatId);
    setSending(false);
  };

  return (
    <SafeAreaView style={styles.mainScreen} edges={['top', 'bottom']}>
      <ScreenHeader
        title={chatInfo?.otherName || 'Chat'}
        onBack={onBack}
      />
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(i) => String(i.id)}
        contentContainerStyle={{ padding: 12, gap: 4 }}
        onContentSizeChange={() =>
          listRef.current?.scrollToEnd?.({ animated: true })
        }
        renderItem={({ item }) => {
          const mine = item.sender_id === userId;
          return (
            <View
              style={[
                styles.messageBubble,
                mine ? styles.myMessage : styles.theirMessage,
              ]}>
              <Text
                style={[
                  styles.messageText,
                  mine ? styles.myMessageText : styles.theirMessageText,
                ]}>
                {item.content}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text
            style={[
              styles.emptyText,
              { textAlign: 'center', marginTop: 30 },
            ]}>
            अभी कोई message नहीं। नमस्ते बोलो! 👋
          </Text>
        }
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.chatInputRow}>
          <TextInput
            style={styles.chatInput}
            placeholder="Message..."
            placeholderTextColor="#777"
            value={text}
            onChangeText={setText}
            multiline
          />
          <TouchableOpacity
            style={styles.chatSendBtn}
            onPress={send}
            disabled={sending || !text.trim()}>
            {sending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Feather name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ⬇️⬇️ PART 6 अगला है ⬇️⬇️
// ============================================
// RIVO — Part 6 of 6 (FINAL)
// Search + Profiles + BottomNav + MainApp + Styles
// ============================================

// ============================================
// SEARCH SCREEN
// ============================================
function SearchScreen({ userId, onUserPress }) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setUsers([]);
      setPosts([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      const q = query.trim();
      const { data: u } = await supabase
        .from('profiles')
        .select('id,username,full_name,avatar_url,verification_status')
        .ilike('username', `%${q}%`)
        .neq('id', userId)
        .limit(15);
      setUsers(u || []);
      const { data: p } = await supabase
        .from('posts')
        .select('id,media_url,media_type,caption')
        .ilike('caption', `%${q}%`)
        .limit(20);
      setPosts(p || []);
      setLoading(false);
    }, 350);
    return () => clearTimeout(t);
  }, [query, userId]);

  return (
    <SafeAreaView style={styles.mainScreen} edges={['top']}>
      <ScreenHeader title="Search" />
      <View style={styles.searchHeader}>
        <View style={styles.searchBox}>
          <Feather name="search" size={20} color="#b0b3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users, posts..."
            placeholderTextColor="#777"
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Feather name="x" size={18} color="#b0b3b8" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      {loading ? (
        <View style={styles.centerScreen}>
          <ActivityIndicator color="#1877F2" size="large" />
        </View>
      ) : !query.trim() ? (
        <View style={styles.centerScreen}>
          <Feather name="search" size={55} color="#555" />
          <Text style={styles.emptyTitle}>Search RIVO</Text>
          <Text style={styles.emptyText}>Users और posts ढूंढो</Text>
        </View>
      ) : (
        <ScrollView>
          {users.length > 0 && (
            <>
              <Text style={styles.searchSection}>PEOPLE</Text>
              {users.map((u) => (
                <TouchableOpacity
                  key={u.id}
                  style={styles.userRow}
                  onPress={() => onUserPress(u.id)}>
                  <UserAvatar
                    avatarUrl={u.avatar_url}
                    username={u.username}
                    size={44}
                  />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View
                      style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={styles.userRowName}>{u.username}</Text>
                      {u.verification_status === 'verified' && (
                        <VerifiedBadge size={12} />
                      )}
                    </View>
                    {u.full_name ? (
                      <Text style={styles.userRowFullName}>{u.full_name}</Text>
                    ) : null}
                  </View>
                  <Feather name="chevron-right" size={20} color="#555" />
                </TouchableOpacity>
              ))}
            </>
          )}
          {posts.length > 0 && (
            <>
              <Text style={styles.searchSection}>POSTS</Text>
              <View style={styles.searchGrid}>
                {posts.map((p) => (
                  <Image
                    key={p.id}
                    source={{ uri: p.media_url }}
                    style={styles.searchGridImg}
                  />
                ))}
              </View>
            </>
          )}
          {users.length === 0 && posts.length === 0 && (
            <View style={styles.centerScreen}>
              <Feather name="frown" size={55} color="#555" />
              <Text style={styles.emptyTitle}>कुछ नहीं मिला</Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ============================================
// USER PROFILE SCREEN
// ============================================
function UserProfileScreen({ profileId, currentUserId, onBack, onChat }) {
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fullscreenItem, setFullscreenItem] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: p } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profileId)
      .maybeSingle();
    setProfile(p);

    const { data: userPosts } = await supabase
      .from('posts')
      .select('id,media_url,media_type')
      .eq('user_id', profileId)
      .order('created_at', { ascending: false });
    setPosts(userPosts || []);

    const { count: f1 } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', profileId);
    const { count: f2 } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', profileId);
    setFollowers(f1 || 0);
    setFollowing(f2 || 0);

    const { data: fcheck } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', currentUserId)
      .eq('following_id', profileId)
      .maybeSingle();
    setIsFollowing(!!fcheck);
    setLoading(false);
  }, [profileId, currentUserId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleFollow = async () => {
    if (isFollowing) {
      await supabase
        .from('follows')
        .delete()
        .eq('follower_id', currentUserId)
        .eq('following_id', profileId);
      setIsFollowing(false);
      setFollowers((f) => Math.max(0, f - 1));
    } else {
      await supabase
        .from('follows')
        .insert({ follower_id: currentUserId, following_id: profileId });
      await supabase.from('notifications').insert({
        user_id: profileId,
        actor_id: currentUserId,
        type: 'follow',
      });
      setIsFollowing(true);
      setFollowers((f) => f + 1);
    }
  };

  const startChat = async () => {
    const { data: myChats } = await supabase
      .from('chat_participants')
      .select('chat_id')
      .eq('user_id', currentUserId);
    const myChatIds = (myChats || []).map((c) => c.chat_id);

    if (myChatIds.length) {
      const { data: commonChats } = await supabase
        .from('chat_participants')
        .select('chat_id')
        .eq('user_id', profileId)
        .in('chat_id', myChatIds);
      if (commonChats && commonChats.length > 0) {
        onChat({
          chatId: commonChats[0].chat_id,
          otherId: profileId,
          otherName: profile?.username,
          otherAvatar: profile?.avatar_url,
        });
        return;
      }
    }

    const { data: newChat } = await supabase
      .from('chats')
      .insert({
        last_message: 'New chat',
        last_message_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (newChat) {
      await supabase.from('chat_participants').insert([
        { chat_id: newChat.id, user_id: currentUserId },
        { chat_id: newChat.id, user_id: profileId },
      ]);
      onChat({
        chatId: newChat.id,
        otherId: profileId,
        otherName: profile?.username,
        otherAvatar: profile?.avatar_url,
      });
    }
  };

  if (loading)
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator color="#1877F2" size="large" />
      </View>
    );

  return (
    <SafeAreaView style={styles.mainScreen} edges={['top']}>
      <ScreenHeader title={profile?.username || 'Profile'} onBack={onBack} />
      <ScrollView>
        <View style={styles.profileHeader}>
          <UserAvatar
            avatarUrl={profile?.avatar_url}
            username={profile?.username}
            size={100}
          />
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: 12,
            }}>
            <Text style={styles.profileUsername}>
              {profile?.username || 'User'}
            </Text>
            {profile?.verification_status === 'verified' && (
              <VerifiedBadge size={16} />
            )}
          </View>
          {profile?.full_name ? (
            <Text style={styles.profileFullNameBelow}>
              {profile.full_name}
            </Text>
          ) : null}
          {profile?.bio ? (
            <Text style={styles.profileBioText}>{profile.bio}</Text>
          ) : null}
          {profile?.website ? (
            <Text style={styles.profileWebsite}>{profile.website}</Text>
          ) : null}

          <View style={styles.profileStats}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{posts.length}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{followers}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{following}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
          </View>

          <View style={styles.profileActionRow}>
            <TouchableOpacity
              style={[
                styles.followButton,
                isFollowing && styles.followButtonActive,
              ]}
              onPress={toggleFollow}>
              <Text
                style={[
                  styles.followButtonText,
                  isFollowing && styles.followButtonTextActive,
                ]}>
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.messageButton} onPress={startChat}>
              <Feather name="message-circle" size={16} color="#fff" />
              <Text style={styles.messageButtonText}>Message</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.grid}>
          {posts.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={styles.gridItem}
              onPress={() => setFullscreenItem(p)}
              activeOpacity={0.8}>
              <Image source={{ uri: p.media_url }} style={styles.gridImage} />
              {p.media_type === 'video' && (
                <View style={styles.gridVideoBadge}>
                  <Feather name="play" size={14} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {posts.length === 0 && (
          <View style={styles.centerScreen}>
            <Feather name="camera" size={45} color="#555" />
            <Text style={styles.emptyText}>अभी कोई post नहीं</Text>
          </View>
        )}
      </ScrollView>

      {fullscreenItem && (
        <Modal
          visible={!!fullscreenItem}
          animationType="fade"
          transparent={false}
          onRequestClose={() => setFullscreenItem(null)}>
          <View style={styles.fullscreenVideoBg}>
            {fullscreenItem.media_type === 'video' ? (
              <ProfileVideoPlayer uri={fullscreenItem.media_url} />
            ) : (
              <Image
                source={{ uri: fullscreenItem.media_url }}
                style={styles.fullscreenVideo}
                resizeMode="contain"
              />
            )}
            <TouchableOpacity
              style={styles.fullscreenCloseBtn}
              onPress={() => setFullscreenItem(null)}>
              <Feather name="x" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

// ============================================
// PROFILE VIDEO PLAYER (helper)
// ============================================
function ProfileVideoPlayer({ uri }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = false;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={styles.fullscreenVideo}
      contentFit="contain"
      nativeControls={true}
      allowsFullscreen
    />
  );
}

// ============================================
// MY PROFILE SCREEN
// ============================================
function ProfileScreen({ userId, onLogout }) {
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [fullscreenItem, setFullscreenItem] = useState(null);

  const load = async () => {
    setLoading(true);
    const { data: p } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    setProfile(p);
    setEditUsername(p?.username || '');
    setEditFullName(p?.full_name || '');
    setEditBio(p?.bio || '');

    const { data: userPosts } = await supabase
      .from('posts')
      .select('id,media_url,media_type')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    setPosts(userPosts || []);

    const { count: f1 } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', userId);
    const { count: f2 } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', userId);
    setFollowers(f1 || 0);
    setFollowing(f2 || 0);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [userId]);

  // ✅ fetch-based upload (FileSystem नहीं)
  const uploadAvatar = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Rivo', 'Gallery permission चाहिए।');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      const response = await fetch(asset.uri);
      const arrayBuffer = await response.arrayBuffer();
      const sizeMB = arrayBuffer.byteLength / (1024 * 1024);
      if (sizeMB > 5) throw new Error('Image 5MB से छोटी होनी चाहिए।');

      const path = `${userId}/avatar_${Date.now()}.jpg`;
      const { error: ue } = await supabase.storage
        .from('avatars')
        .upload(path, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });
      if (ue) throw new Error(ue.message);

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(path);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: urlData.publicUrl })
        .eq('id', userId);

      if (updateError) throw updateError;

      setProfile((p) => ({ ...p, avatar_url: urlData.publicUrl }));
      Alert.alert('Rivo', 'Photo update हो गई! ✅');
    } catch (e) {
      Alert.alert('Error', e?.message || 'Photo upload नहीं हुई।');
    }
  };

  const saveProfile = async () => {
    const { error } = await supabase
      .from('profiles')
      .update({
        username: editUsername.trim(),
        full_name: editFullName.trim(),
        bio: editBio.trim(),
      })
      .eq('id', userId);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    setEditing(false);
    load();
  };

  if (loading)
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator color="#1877F2" size="large" />
      </View>
    );

  return (
    <SafeAreaView style={styles.mainScreen} edges={['top']}>
      <ScreenHeader title="My Profile" />
      <ScrollView>
        <View style={styles.profileHeader}>
          <View style={{ position: 'relative' }}>
            <UserAvatar
              avatarUrl={profile?.avatar_url}
              username={profile?.username}
              size={100}
            />
            <TouchableOpacity
              style={styles.avatarEditBadge}
              onPress={uploadAvatar}>
              <Feather name="camera" size={14} color="#fff" />
            </TouchableOpacity>
          </View>

          {editing ? (
            <View style={styles.editBox}>
              <TextInput
                style={styles.editInput}
                placeholder="Username"
                placeholderTextColor="#777"
                value={editUsername}
                onChangeText={setEditUsername}
              />
              <TextInput
                style={styles.editInput}
                placeholder="Full Name"
                placeholderTextColor="#777"
                value={editFullName}
                onChangeText={setEditFullName}
              />
              <TextInput
                style={[styles.editInput, { minHeight: 80 }]}
                placeholder="Bio"
                placeholderTextColor="#777"
                value={editBio}
                onChangeText={setEditBio}
                multiline
              />
              <View style={styles.editButtons}>
                <TouchableOpacity
                  style={styles.primarySmall}
                  onPress={saveProfile}>
                  <Text style={styles.primarySmallText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelSmall}
                  onPress={() => setEditing(false)}>
                  <Text style={styles.cancelSmallText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.profileUsername}>
                {profile?.username || 'User'}
              </Text>
              {profile?.full_name ? (
                <Text style={styles.profileFullNameBelow}>
                  {profile.full_name}
                </Text>
              ) : null}
              {profile?.bio ? (
                <Text style={styles.profileBioText}>{profile.bio}</Text>
              ) : null}

              <View style={styles.profileStats}>
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{posts.length}</Text>
                  <Text style={styles.statLabel}>Posts</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{followers}</Text>
                  <Text style={styles.statLabel}>Followers</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{following}</Text>
                  <Text style={styles.statLabel}>Following</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.profileEditButton}
                onPress={() => setEditing(true)}>
                <Feather name="edit-2" size={16} color="#fff" />
                <Text style={styles.profileEditText}>Edit Profile</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.logoutButton}
                onPress={onLogout}>
                <Feather name="log-out" size={18} color="#ff5c5c" />
                <Text style={styles.logoutText}>Log Out</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.grid}>
          {posts.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={styles.gridItem}
              onPress={() => setFullscreenItem(p)}
              activeOpacity={0.8}>
              <Image source={{ uri: p.media_url }} style={styles.gridImage} />
              {p.media_type === 'video' && (
                <View style={styles.gridVideoBadge}>
                  <Feather name="play" size={14} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {posts.length === 0 && (
          <View style={styles.centerScreen}>
            <Feather name="camera" size={45} color="#555" />
            <Text style={styles.emptyText}>अभी कोई post नहीं</Text>
          </View>
        )}
      </ScrollView>

      {fullscreenItem && (
        <Modal
          visible={!!fullscreenItem}
          animationType="fade"
          transparent={false}
          onRequestClose={() => setFullscreenItem(null)}>
          <View style={styles.fullscreenVideoBg}>
            {fullscreenItem.media_type === 'video' ? (
              <ProfileVideoPlayer uri={fullscreenItem.media_url} />
            ) : (
              <Image
                source={{ uri: fullscreenItem.media_url }}
                style={styles.fullscreenVideo}
                resizeMode="contain"
              />
            )}
            <TouchableOpacity
              style={styles.fullscreenCloseBtn}
              onPress={() => setFullscreenItem(null)}>
              <Feather name="x" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

// ============================================
// BOTTOM NAV
// ============================================
function BottomNav({ active, onChange, onCreate, userProfile, unreadNotifs }) {
  const items = [
    { key: 'home', icon: 'home', label: 'Home' },
    { key: 'friends', icon: 'users', label: 'Friends' },
    { key: 'reels', icon: 'video', label: 'Reels' },
    { key: 'marketplace', icon: 'shopping-bag', label: 'Market' },
    { key: 'notifications', icon: 'bell', label: 'Notifications' },
    { key: 'menu', icon: 'menu', label: 'Menu' },
  ];

  return (
    <SafeAreaView style={styles.bottomNav} edges={['bottom']}>
      {items.map((item) => {
        const sel = active === item.key;
        const isNotifs = item.key === 'notifications';
        return (
          <TouchableOpacity
            key={item.key}
            style={styles.navItem}
            onPress={() => onChange(item.key)}
            activeOpacity={0.7}>
            {sel && <View style={styles.navUnderline} />}
            <Feather
              name={item.icon}
              size={24}
              color={sel ? '#1877F2' : '#b0b3b8'}
            />
            <Text
              style={[styles.navLabel, sel && styles.navLabelActive]}
              numberOfLines={1}>
              {item.label}
            </Text>
            {isNotifs && unreadNotifs > 0 && (
              <View style={styles.navBadge}>
                <Text style={styles.navBadgeText}>
                  {unreadNotifs > 9 ? '9+' : unreadNotifs}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </SafeAreaView>
  );
}

// ============================================
// MAIN APP
// ============================================
function MainApp({ user }) {
  const [screen, setScreen] = useState('home');
  const [createVisible, setCreateVisible] = useState(false);
  const [viewingUserId, setViewingUserId] = useState(null);
  const [activeChat, setActiveChat] = useState(null);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [cameraCaption, setCameraCaption] = useState('');
  const [sharePost, setSharePost] = useState(null);
  const [newReelUri, setNewReelUri] = useState(null);
  const [reelUploading, setReelUploading] = useState(false);
  const [, forceRefresh] = useState(0);

  const [userProfile, setUserProfile] = useState(null);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [unreadChats, setUnreadChats] = useState(0);

  const refreshHome = () => forceRefresh((v) => v + 1);

  useEffect(() => {
    let mounted = true;
    const loadCounts = async () => {
      const { data: p } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      if (!mounted) return;
      setUserProfile(p);
      const { count: n } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      if (!mounted) return;
      setUnreadNotifs(n || 0);
      const { data: myChats } = await supabase
        .from('chat_participants')
        .select('chat_id')
        .eq('user_id', user.id);
      const chatIds = (myChats || []).map((c) => c.chat_id);
      if (chatIds.length > 0) {
        const { count: m } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .in('chat_id', chatIds)
          .neq('sender_id', user.id);
        if (!mounted) return;
        setUnreadChats(m || 0);
      }
    };
    loadCounts();
    const notifChannel = supabase
      .channel(`main-notif-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => loadCounts()
      )
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(notifChannel);
    };
  }, [user.id]);

  useEffect(() => {
    registerForPushNotifications(user.id);
  }, [user.id]);

  const logout = async () => {
    Alert.alert('Logout', 'क्या logout करना है?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
        },
      },
    ]);
  };

  const openUserProfile = (uid) => {
    if (uid === user.id) {
      setScreen('profile');
      setViewingUserId(null);
    } else {
      setViewingUserId(uid);
      setScreen('userProfile');
    }
  };

  const handleCameraCapture = async (capture) => {
    setCameraVisible(false);
    try {
      const resp = await fetch(capture.uri);
      const buf = await resp.arrayBuffer();
      const ext = capture.type === 'video' ? 'mp4' : 'jpg';
      const mt = capture.type === 'video' ? 'video/mp4' : 'image/jpeg';
      const path = `${user.id}/${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}.${ext}`;
      const { error: ue } = await supabase.storage
        .from('posts')
        .upload(path, buf, { contentType: mt, upsert: false });
      if (ue) {
        Alert.alert('Upload Error', ue.message);
        return;
      }
      const { data: ud } = supabase.storage.from('posts').getPublicUrl(path);
      const { error: de } = await supabase.from('posts').insert({
        user_id: user.id,
        media_url: ud.publicUrl,
        media_type: capture.type,
        caption: cameraCaption.trim() || null,
      });
      if (de) {
        Alert.alert('Post Error', de.message);
        return;
      }
      setCameraCaption('');
      refreshHome();
      Alert.alert('Rivo', 'Posted!');
    } catch (e) {
      Alert.alert('Error', e?.message);
    }
  };

  const handleReelShare = async (finalCaption) => {
    if (!newReelUri) return;
    setReelUploading(true);
    try {
      const resp = await fetch(newReelUri);
      const buf = await resp.arrayBuffer();
      const path = `${user.id}/${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}.mp4`;
      const { error: ue } = await supabase.storage
        .from('posts')
        .upload(path, buf, { contentType: 'video/mp4', upsert: false });
      if (ue) throw new Error(ue.message);
      const { data: ud } = supabase.storage.from('posts').getPublicUrl(path);
      const { error: de } = await supabase.from('posts').insert({
        user_id: user.id,
        media_url: ud.publicUrl,
        media_type: 'video',
        caption: finalCaption,
      });
      if (de) throw new Error(de.message);
      setNewReelUri(null);
      setReelUploading(false);
      refreshHome();
      Alert.alert('Rivo', '🎬 Reel posted!');
    } catch (e) {
      setReelUploading(false);
      Alert.alert('Upload Error', e.message);
    }
  };

  const handleOpenReelPicker = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Rivo', 'Gallery permission चाहिए।');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsMultipleSelection: false,
      quality: 0.8,
      videoMaxDuration: 60,
    });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (asset?.uri) setNewReelUri(asset.uri);
  };

  if (cameraVisible)
    return (
      <CameraScreen
        onClose={() => setCameraVisible(false)}
        onCaptured={handleCameraCapture}
      />
    );
  if (newReelUri)
    return (
      <NewReelScreen
        videoUri={newReelUri}
        onBack={() => setNewReelUri(null)}
        onShare={handleReelShare}
        uploading={reelUploading}
      />
    );

  let content = null;
  if (screen === 'home')
    content = (
      <HomeScreen
        userId={user.id}
        onCreate={() => setCreateVisible(true)}
        onUserPress={openUserProfile}
        onSharePost={setSharePost}
        onSearch={() => setScreen('search')}
        onChat={() => setScreen('chatList')}
        unreadChats={unreadChats}
        unreadNotifs={unreadNotifs}
      />
    );
  if (screen === 'friends')
    content = <FriendsScreen userId={user.id} onUserPress={openUserProfile} />;
  if (screen === 'reels') content = <ReelsScreen userId={user.id} />;
  if (screen === 'marketplace') content = <MarketplaceScreen />;
  if (screen === 'notifications')
    content = (
      <NotificationsScreen
        currentUserId={user.id}
        onUserPress={openUserProfile}
      />
    );
  if (screen === 'menu')
    content = (
      <MenuScreen
        userId={user.id}
        onUserPress={openUserProfile}
        onLogout={logout}
      />
    );
  if (screen === 'search')
    content = <SearchScreen userId={user.id} onUserPress={openUserProfile} />;
  if (screen === 'chatList')
    content = (
      <ChatListScreen
        userId={user.id}
        onOpenChat={(c) => {
          setActiveChat(c);
          setScreen('chatRoom');
        }}
        onUserPress={openUserProfile}
      />
    );
  if (screen === 'chatRoom' && activeChat)
    content = (
      <ChatRoomScreen
        chatInfo={activeChat}
        userId={user.id}
        onBack={() => {
          setActiveChat(null);
          setScreen('chatList');
        }}
      />
    );
  if (screen === 'userProfile' && viewingUserId)
    content = (
      <UserProfileScreen
        profileId={viewingUserId}
        currentUserId={user.id}
        onBack={() => setScreen('home')}
        onChat={(c) => {
          setActiveChat(c);
          setScreen('chatRoom');
        }}
      />
    );
  if (screen === 'profile')
    content = <ProfileScreen userId={user.id} onLogout={logout} />;

  const showBottomNav = ![
    'chatRoom',
    'userProfile',
    'profile',
    'search',
  ].includes(screen);

  return (
    <View style={styles.appRoot}>
      {content}
      {showBottomNav && (
        <BottomNav
          active={screen}
          onChange={setScreen}
          onCreate={() => setCreateVisible(true)}
          userProfile={userProfile}
          unreadNotifs={unreadNotifs}
        />
      )}
      <CreateModal
        visible={createVisible}
        userId={user.id}
        onClose={() => setCreateVisible(false)}
        onCreated={refreshHome}
        onOpenCamera={(c) => {
          setCameraCaption(c || '');
          setCameraVisible(true);
        }}
        onOpenReel={handleOpenReelPicker}
      />
      <ShareModal
        visible={!!sharePost}
        post={sharePost}
        currentUserId={user.id}
        onClose={() => setSharePost(null)}
      />
    </View>
  );
}

// ============================================
// ROOT APP
// ============================================
export default function App() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_700Bold,
    Poppins_900Black,
  });
  const [session, setSession] = useState(null);
  const [authScreen, setAuthScreen] = useState('login');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let m = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!m) return;
      setSession(data?.session || null);
      setLoading(false);
    });
    const { data: l } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
    });
    return () => {
      m = false;
      l?.subscription?.unsubscribe();
    };
  }, []);

  if (!fontsLoaded || loading) {
    return (
      <SafeAreaProvider>
        <View style={styles.centerScreen}>
          <StatusBar style="light" />
          <LinearGradient
            colors={['#1877F2', '#7b2ff7']}
            style={styles.loadingLogo}>
            <Text style={styles.loadingLogoText}>R</Text>
          </LinearGradient>
          <Text style={styles.loadingBrand}>RIVO</Text>
          <ActivityIndicator color="#fff" size="small" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor="#242526" translucent={false} />
      {session?.user ? (
        <MainApp user={session.user} />
      ) : authScreen === 'signup' ? (
        <SignupScreen onBack={() => setAuthScreen('login')} />
      ) : authScreen === 'forgot' ? (
        <ForgotPasswordScreen onBack={() => setAuthScreen('login')} />
      ) : (
        <LoginScreen
          onSignup={() => setAuthScreen('signup')}
          onForgot={() => setAuthScreen('forgot')}
        />
      )}
    </SafeAreaProvider>
  );
}

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
  // ===== ROOT =====
  appRoot: { flex: 1, backgroundColor: '#18191a' },
  mainScreen: { flex: 1, backgroundColor: '#18191a' },
  reelsScreen: { flex: 1, backgroundColor: '#000' },
  centerScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#18191a',
    padding: 20,
  },
  loadingText: {
    color: '#b0b3b8',
    marginTop: 12,
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
  },
  loadingLogo: {
    width: 75,
    height: 75,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLogoText: {
    color: '#fff',
    fontSize: 44,
    fontWeight: '900',
    fontFamily: 'Poppins_900Black',
  },
  loadingBrand: {
    color: '#fff',
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: 5,
    marginVertical: 18,
    fontFamily: 'Poppins_900Black',
  },

  // ===== AUTH =====
  authScreen: {
    flex: 1,
    backgroundColor: '#18191a',
    alignItems: 'center',
    paddingHorizontal: 25,
    paddingTop: 70,
  },
  authLogo: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  authLogoText: {
    color: '#fff',
    fontSize: 50,
    fontWeight: '900',
    fontFamily: 'Poppins_900Black',
  },
  authTitle: {
    color: '#fff',
    fontSize: 31,
    fontWeight: '900',
    letterSpacing: 3,
    marginBottom: 8,
    fontFamily: 'Poppins_900Black',
  },
  authSubtitle: {
    color: '#b0b3b8',
    fontSize: 15,
    marginBottom: 35,
    fontFamily: 'Poppins_400Regular',
  },
  authInput: {
    width: '100%',
    height: 54,
    backgroundColor: '#3a3b3c',
    borderWidth: 1,
    borderColor: '#3a3b3c',
    borderRadius: 12,
    color: '#fff',
    paddingHorizontal: 16,
    marginBottom: 13,
    fontSize: 15,
    fontFamily: 'Poppins_400Regular',
  },
  primaryButton: {
    width: '100%',
    height: 54,
    borderRadius: 12,
    backgroundColor: '#1877F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'Poppins_700Bold',
  },
  linkButton: { padding: 15 },
  linkText: {
    color: '#1877F2',
    fontWeight: '700',
    fontFamily: 'Poppins_700Bold',
  },
  authDivider: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#3a3b3c' },
  orText: {
    color: '#888',
    marginHorizontal: 12,
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
  },
  outlineButton: {
    width: '100%',
    height: 54,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1877F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontFamily: 'Poppins_700Bold',
  },
  backButton: { alignSelf: 'flex-start', marginBottom: 35 },

  // ===== TOP BAR =====
  topBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: '#242526',
    borderBottomWidth: 1,
    borderBottomColor: '#3a3b3c',
  },
  topIconLeft: { padding: 4 },
  brandText: {
    color: '#1877F2',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
    marginLeft: 12,
    fontFamily: 'Poppins_900Black',
    flex: 1,
  },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  topIcon: { padding: 8, position: 'relative' },
  topIconBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#f3425f',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#242526',
  },
  topIconBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'Poppins_700Bold',
  },

  // ===== MIND BAR =====
  mindBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#242526',
    marginTop: 6,
    marginHorizontal: 6,
    borderRadius: 10,
  },
  mindInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#3a3b3c',
    borderRadius: 20,
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginHorizontal: 10,
  },
  mindPlaceholder: {
    color: '#b0b3b8',
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
  },
  mindIconBtn: { padding: 4 },
  mindActions: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#242526',
    marginHorizontal: 6,
    marginBottom: 6,
    borderRadius: 10,
    justifyContent: 'space-around',
  },
  mindAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mindActionText: {
    color: '#b0b3b8',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Poppins_700Bold',
  },

  // ===== STORY =====
  storyContainer: { backgroundColor: '#18191a', paddingVertical: 6 },
  storyCard: {
    width: 112,
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#242526',
    position: 'relative',
  },
  storyCardBg: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  storyCardOverlay: { ...StyleSheet.absoluteFillObject },
  storyCardAvatarRing: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: '#1877F2',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
    backgroundColor: '#18191a',
  },
  storyCardName: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Poppins_700Bold',
  },
  storyCreateIcon: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    left: 34,
  },

  // ===== POST =====
  postCard: {
    backgroundColor: '#242526',
    marginHorizontal: 6,
    marginVertical: 4,
    borderRadius: 10,
    paddingBottom: 6,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  postUsername: {
    color: '#e4e6eb',
    fontWeight: '800',
    fontSize: 14,
    fontFamily: 'Poppins_700Bold',
  },
  postDate: {
    color: '#b0b3b8',
    fontSize: 11,
    marginTop: 2,
    fontFamily: 'Poppins_400Regular',
  },
  moreButton: { padding: 4 },
  postImage: { width: '100%', aspectRatio: 1, backgroundColor: '#111' },
  videoPostContainer: {
    width: '100%',
    backgroundColor: '#000',
    position: 'relative',
  },
  postVideo: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  videoTapLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoLoading: { alignItems: 'center', justifyContent: 'center' },
  videoError: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#000d',
  },
  videoErrorText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 10,
    fontFamily: 'Poppins_700Bold',
  },

  // ===== FULLSCREEN VIDEO =====
  fullscreenVideoBg: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenVideo: { width: '100%', height: '100%' },
  fullscreenCloseBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ===== PHOTO FULLSCREEN =====
  photoFullscreenBg: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoFullscreenImage: { width: '100%', height: '100%' },
  photoFullscreenCloseBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  postStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  likesRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  likeIconBg: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#f3425f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsText: {
    color: '#b0b3b8',
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
  },
  postDivider: { height: 1, backgroundColor: '#3a3b3c', marginHorizontal: 12 },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 6,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  actionText: {
    color: '#b0b3b8',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Poppins_700Bold',
  },
  captionBox: { paddingHorizontal: 12, paddingVertical: 8 },
  captionText: {
    color: '#e4e6eb',
    lineHeight: 20,
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
  },
  heartPop: {
    position: 'absolute',
    top: '35%',
    left: '35%',
    opacity: 0.9,
    zIndex: 10,
  },

  // ===== REELS =====
  reelItem: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT - 80,
    backgroundColor: '#000',
    position: 'relative',
  },
  reelVideoWrap: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
  reelVideo: { width: '100%', height: '100%' },
  reelLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0008',
  },
  reelTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
  },
  reelTopLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  reelTopUsername: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    fontFamily: 'Poppins_700Bold',
  },
  reelTopSubtitle: {
    color: '#ddd',
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
  },
  reelTopRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reelFollowBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  reelFollowBtnActive: { backgroundColor: '#333', borderColor: '#666' },
  reelFollowBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Poppins_700Bold',
  },
  reelBottomLeft: {
    position: 'absolute',
    left: 14,
    right: 80,
    bottom: 90,
  },
  reelCaptionUsername: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    fontFamily: 'Poppins_700Bold',
  },
  reelCaptionText: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Poppins_400Regular',
  },
  reelActionsColumn: {
    position: 'absolute',
    right: 10,
    bottom: 80,
    alignItems: 'center',
    gap: 20,
  },
  reelActionBtn: { alignItems: 'center' },
  reelActionCount: {
    color: '#fff',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
    fontFamily: 'Poppins_700Bold',
  },

  // ===== SCREEN HEADER =====
  screenHeaderBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    backgroundColor: '#242526',
    borderBottomWidth: 1,
    borderBottomColor: '#3a3b3c',
  },
  screenHeaderBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenHeaderTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    fontFamily: 'Poppins_900Black',
    flex: 1,
    textAlign: 'center',
  },

  // ===== SIMPLE HEADER =====
  simpleHeader: {
    minHeight: 56,
    paddingHorizontal: 16,
    justifyContent: 'center',
    backgroundColor: '#242526',
    borderBottomWidth: 1,
    borderBottomColor: '#3a3b3c',
  },
  screenTitle: {
    color: '#e4e6eb',
    fontSize: 22,
    fontWeight: '900',
    fontFamily: 'Poppins_900Black',
  },
  emptyContainer: { alignItems: 'center', padding: 30 },
  emptyTitle: {
    color: '#e4e6eb',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 15,
    fontFamily: 'Poppins_700Bold',
  },
  emptyText: {
    color: '#b0b3b8',
    textAlign: 'center',
    marginTop: 8,
    fontFamily: 'Poppins_400Regular',
  },

  // ===== FRIENDS =====
  friendsTabs: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#242526',
  },
  friendsTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#3a3b3c',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  friendsTabActive: { backgroundColor: '#1877F2' },
  friendsTabText: {
    color: '#b0b3b8',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Poppins_700Bold',
  },
  friendsTabTextActive: { color: '#fff' },
  tabBadge: {
    backgroundColor: '#f3425f',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'Poppins_700Bold',
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  friendName: {
    color: '#e4e6eb',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Poppins_700Bold',
  },
  friendMutual: {
    color: '#b0b3b8',
    fontSize: 12,
    marginTop: 3,
    fontFamily: 'Poppins_400Regular',
  },
  friendActionRow: { flexDirection: 'row', gap: 6 },
  addFriendBtn: {
    backgroundColor: '#1877F2',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addFriendBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Poppins_700Bold',
  },
  removeBtn: {
    backgroundColor: '#3a3b3c',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  removeBtnText: {
    color: '#e4e6eb',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Poppins_700Bold',
  },
  confirmBtn: {
    backgroundColor: '#1877F2',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Poppins_700Bold',
  },
  deleteBtn: {
    backgroundColor: '#3a3b3c',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  deleteBtnText: {
    color: '#e4e6eb',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Poppins_700Bold',
  },

  // ===== MARKETPLACE =====
  categoryItem: { alignItems: 'center', width: 80 },
  categoryItemActive: {},
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#242526',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3a3b3c',
  },
  categoryIconActive: { backgroundColor: '#1877F2', borderColor: '#1877F2' },
  categoryLabel: {
    color: '#b0b3b8',
    fontSize: 11,
    marginTop: 6,
    fontFamily: 'Poppins_400Regular',
  },
  categoryLabelActive: { color: '#1877F2', fontWeight: '700' },
  marketFilters: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  marketFilter: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: '#3a3b3c',
  },
  marketFilterActive: { backgroundColor: '#1877F2' },
  marketFilterText: {
    color: '#b0b3b8',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Poppins_700Bold',
  },
  marketFilterTextActive: { color: '#fff' },
  productCard: {
    flex: 1,
    backgroundColor: '#242526',
    borderRadius: 10,
    overflow: 'hidden',
  },
  productImage: { width: '100%', aspectRatio: 1.2, backgroundColor: '#3a3b3c' },
  productInfo: { padding: 10 },
  productTitle: {
    color: '#e4e6eb',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Poppins_700Bold',
  },
  productPrice: {
    color: '#1877F2',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 4,
    fontFamily: 'Poppins_900Black',
  },
  productLocation: {
    color: '#b0b3b8',
    fontSize: 11,
    marginTop: 2,
    fontFamily: 'Poppins_400Regular',
  },

  // ===== NOTIFICATIONS =====
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  notifRowUnread: { backgroundColor: '#242526' },
  notifIconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#18191a',
  },
  notifText: {
    color: '#e4e6eb',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Poppins_400Regular',
  },
  notifUsername: {
    color: '#fff',
    fontWeight: '800',
    fontFamily: 'Poppins_700Bold',
  },
  notifTime: {
    color: '#b0b3b8',
    fontSize: 12,
    marginTop: 3,
    fontFamily: 'Poppins_400Regular',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1877F2',
    marginLeft: 8,
  },

  // ===== MENU =====
  menuProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  menuProfileName: {
    color: '#e4e6eb',
    fontSize: 17,
    fontWeight: '800',
    fontFamily: 'Poppins_700Bold',
  },
  menuProfileSub: {
    color: '#b0b3b8',
    fontSize: 12,
    marginTop: 2,
    fontFamily: 'Poppins_400Regular',
  },
  menuDivider: { height: 1, backgroundColor: '#3a3b3c', marginVertical: 6 },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3a3b3c',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  menuRowText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Poppins_700Bold',
  },
  menuBadge: {
    backgroundColor: '#f3425f',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginRight: 8,
  },
  menuBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'Poppins_700Bold',
  },

  // ===== BOTTOM NAV =====
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#242526',
    borderTopWidth: 1,
    borderTopColor: '#3a3b3c',
    paddingTop: 6,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    position: 'relative',
  },
  navLabel: {
    color: '#b0b3b8',
    fontSize: 10,
    marginTop: 3,
    fontFamily: 'Poppins_400Regular',
  },
  navLabelActive: {
    color: '#1877F2',
    fontWeight: '700',
    fontFamily: 'Poppins_700Bold',
  },
  navUnderline: {
    position: 'absolute',
    top: 0,
    left: '20%',
    right: '20%',
    height: 3,
    backgroundColor: '#1877F2',
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  navBadge: {
    position: 'absolute',
    top: 2,
    right: '15%',
    backgroundColor: '#f3425f',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#242526',
  },
  navBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'Poppins_700Bold',
  },

  // ===== MODALS =====
  modalOverlay: {
    flex: 1,
    backgroundColor: '#0009',
    justifyContent: 'flex-end',
  },
  createSheet: {
    backgroundColor: '#242526',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 20,
    minHeight: 330,
  },
  createSheetBig: {
    backgroundColor: '#242526',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
  },
  commentsSheet: {
    height: '75%',
    backgroundColor: '#242526',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 18,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  sheetTitle: {
    color: '#e4e6eb',
    fontSize: 21,
    fontWeight: '900',
    fontFamily: 'Poppins_900Black',
  },
  createOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3a3b3c',
    padding: 14,
    borderRadius: 15,
    marginBottom: 12,
  },
  createIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  createOptionTitle: {
    color: '#e4e6eb',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'Poppins_700Bold',
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3b3c',
  },
  createRowIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createRowTitle: {
    color: '#e4e6eb',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'Poppins_700Bold',
  },
  createRowSub: {
    color: '#b0b3b8',
    fontSize: 12,
    marginTop: 3,
    fontFamily: 'Poppins_400Regular',
  },
  createNewBadge: {
    backgroundColor: '#1877F2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginRight: 8,
  },
  createNewBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'Poppins_700Bold',
  },
  uploadingBox: { height: 180, alignItems: 'center', justifyContent: 'center' },
  uploadingText: {
    color: '#e4e6eb',
    marginTop: 12,
    fontWeight: '700',
    fontFamily: 'Poppins_700Bold',
  },

  // ===== POST PREVIEW =====
  previewScreen: {
    flex: 1,
    backgroundColor: '#000',
  },
  previewHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    backgroundColor: '#18191a',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  previewHeaderTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'Poppins_700Bold',
  },
  previewPostBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1877F2',
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewPostBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    fontFamily: 'Poppins_700Bold',
  },
  previewMediaWrap: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewMedia: {
    width: '100%',
    height: '100%',
  },
  previewCaptionWrap: {
    backgroundColor: '#18191a',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  previewCaptionInput: {
    color: '#fff',
    fontSize: 15,
    minHeight: 60,
    maxHeight: 120,
    textAlignVertical: 'top',
    fontFamily: 'Poppins_400Regular',
    lineHeight: 22,
  },
  previewCaptionCounter: {
    color: '#666',
    fontSize: 11,
    marginTop: 6,
    textAlign: 'right',
    fontFamily: 'Poppins_400Regular',
  },

  // ===== COMMENTS =====
  commentRow: {
    flexDirection: 'row',
    marginBottom: 17,
    alignItems: 'flex-start',
  },
  commentUser: {
    color: '#e4e6eb',
    fontWeight: '800',
    fontSize: 13,
    fontFamily: 'Poppins_700Bold',
  },
  commentText: {
    color: '#b0b3b8',
    fontSize: 13,
    marginTop: 3,
    fontFamily: 'Poppins_400Regular',
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#3a3b3c',
    paddingTop: 10,
  },
  commentInput: {
    flex: 1,
    minHeight: 45,
    backgroundColor: '#3a3b3c',
    borderRadius: 22,
    color: '#fff',
    paddingHorizontal: 15,
    fontFamily: 'Poppins_400Regular',
  },
  commentSend: {
    width: 45,
    height: 45,
    borderRadius: 23,
    backgroundColor: '#1877F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  // ===== MENU MODAL =====
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: '#242526',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 15,
    paddingBottom: 30,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    gap: 14,
  },
  menuText: {
    color: '#e4e6eb',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Poppins_400Regular',
  },

  // ===== CAMERA =====
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  cameraTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
  },
  cameraTopBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 40,
    paddingTop: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  cameraModeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 30,
    marginBottom: 25,
  },
  cameraModeText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
    fontFamily: 'Poppins_700Bold',
  },
  cameraModeActive: { color: '#fff' },
  cameraCaptureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
  },
  cameraCaptureBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  cameraCaptureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  cameraCaptureInnerVideo: { backgroundColor: '#ff3040' },
  cameraFlipBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraPermissionScreen: {
    flex: 1,
    backgroundColor: '#18191a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  cameraPermissionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 20,
    textAlign: 'center',
    fontFamily: 'Poppins_700Bold',
  },

  // ===== STORY VIEWER =====
  storyViewerBg: { flex: 1, backgroundColor: '#000' },
  storyProgressRow: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    gap: 4,
    marginTop: 5,
  },
  storyProgressBar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  storyViewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  storyViewerName: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
    fontFamily: 'Poppins_700Bold',
  },
  storyViewerImage: { flex: 1, width: '100%' },
  storyViewerCaption: {
    color: '#fff',
    textAlign: 'center',
    padding: 20,
    fontSize: 16,
    fontFamily: 'Poppins_400Regular',
  },
  storyNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  storyNavBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ===== NEW REEL =====
  nrTopBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3b3c',
  },
  nrBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#242526',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nrTitle: {
    color: '#e4e6eb',
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Poppins_700Bold',
  },
  nrPreviewWrap: { paddingHorizontal: 14, paddingTop: 16 },
  nrPreviewCard: {
    backgroundColor: '#242526',
    borderRadius: 24,
    padding: 12,
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderColor: '#3a3b3c',
  },
  nrPreviewVideo: {
    width: 124,
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
  },
  nrCaptionBox: { flex: 1, paddingVertical: 4 },
  nrCaptionInput: {
    color: '#e4e6eb',
    fontSize: 14.5,
    minHeight: 78,
    maxHeight: 140,
    textAlignVertical: 'top',
    fontFamily: 'Poppins_400Regular',
    lineHeight: 22,
  },
  nrCaptionCounter: {
    color: '#b0b3b8',
    fontSize: 11,
    marginTop: 8,
    fontFamily: 'Poppins_400Regular',
  },
  nrBottomBar: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#18191a',
    borderTopWidth: 1,
    borderTopColor: '#3a3b3c',
  },
  nrShareBtn: {
    height: 56,
    borderRadius: 16,
    backgroundColor: '#1877F2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nrShareBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
    fontFamily: 'Poppins_700Bold',
  },

  // ===== SEARCH =====
  searchBox: {
    height: 48,
    margin: 15,
    borderRadius: 12,
    backgroundColor: '#3a3b3c',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    marginLeft: 10,
    fontFamily: 'Poppins_400Regular',
  },
  searchHeader: {
    padding: 6,
    backgroundColor: '#242526',
    borderBottomWidth: 1,
    borderBottomColor: '#3a3b3c',
  },
  searchSection: {
    color: '#b0b3b8',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 6,
    letterSpacing: 1,
    fontFamily: 'Poppins_700Bold',
  },
  searchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    gap: 4,
  },
  searchGridImg: {
    width: (SCREEN_WIDTH - 24) / 3,
    height: (SCREEN_WIDTH - 24) / 3,
    borderRadius: 6,
    backgroundColor: '#111',
  },

  // ===== USER ROW =====
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  userRowName: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
    fontFamily: 'Poppins_700Bold',
  },
  userRowFullName: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
    fontFamily: 'Poppins_400Regular',
  },

  // ===== PROFILE =====
  profileHeader: { alignItems: 'center', padding: 20 },
  profileUsername: {
    color: '#fff',
    fontSize: 23,
    fontWeight: '900',
    marginTop: 12,
    fontFamily: 'Poppins_900Black',
  },
  profileFullNameBelow: {
    color: '#bbb',
    fontSize: 14,
    marginTop: 4,
    fontFamily: 'Poppins_400Regular',
  },
  profileBioText: {
    color: '#ddd',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
    lineHeight: 20,
    fontFamily: 'Poppins_400Regular',
  },
  profileWebsite: {
    color: '#d05cff',
    marginTop: 6,
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e0218a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0d0d0d',
  },
  profileStats: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 25,
  },
  statBox: { alignItems: 'center' },
  statNumber: {
    color: '#fff',
    fontSize: 19,
    fontWeight: '900',
    fontFamily: 'Poppins_700Bold',
  },
  statLabel: {
    color: '#777',
    fontSize: 12,
    marginTop: 3,
    fontFamily: 'Poppins_400Regular',
  },
  profileEditButton: {
    height: 42,
    paddingHorizontal: 25,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileEditText: {
    color: '#fff',
    fontWeight: '700',
    marginLeft: 7,
    fontFamily: 'Poppins_700Bold',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
  },
  logoutText: {
    color: '#ff5c5c',
    marginLeft: 7,
    fontWeight: '700',
    fontFamily: 'Poppins_700Bold',
  },
  editBox: { width: '100%', gap: 10 },
  editInput: {
    minHeight: 48,
    backgroundColor: '#1b1b1b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
    color: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'Poppins_400Regular',
  },
  editButtons: {
    flexDirection: 'row',
    marginTop: 10,
    justifyContent: 'center',
  },
  primarySmall: {
    backgroundColor: '#7b2ff7',
    paddingHorizontal: 25,
    paddingVertical: 10,
    borderRadius: 9,
    marginRight: 8,
  },
  primarySmallText: {
    color: '#fff',
    fontWeight: '800',
    fontFamily: 'Poppins_700Bold',
  },
  cancelSmall: {
    backgroundColor: '#292929',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 9,
  },
  cancelSmallText: {
    color: '#fff',
    fontWeight: '700',
    fontFamily: 'Poppins_700Bold',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  gridItem: {
    width: SCREEN_WIDTH / 3,
    height: SCREEN_WIDTH / 3,
    borderWidth: 0.5,
    borderColor: '#222',
    position: 'relative',
  },
  gridImage: { width: '100%', height: '100%' },
  gridVideoBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  followButton: {
    backgroundColor: '#7b2ff7',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 10,
  },
  followButtonActive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#444',
  },
  followButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
    fontFamily: 'Poppins_700Bold',
  },
  followButtonTextActive: { color: '#fff' },
  profileActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 5,
    alignItems: 'center',
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#444',
    gap: 6,
  },
  messageButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    fontFamily: 'Poppins_700Bold',
  },

  // ===== CHAT =====
  chatHeader: {
    height: 62,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#202020',
    backgroundColor: '#0d0d0d',
    gap: 12,
  },
  chatHeaderName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'Poppins_700Bold',
  },
  chatHeaderFullName: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
    fontFamily: 'Poppins_400Regular',
  },
  messageBubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    marginBottom: 8,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#1877F2',
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#3a3b3c',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: 'Poppins_400Regular',
  },
  myMessageText: { color: '#fff' },
  theirMessageText: { color: '#fff' },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#222',
    backgroundColor: '#0d0d0d',
  },
  chatInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    backgroundColor: '#3a3b3c',
    borderRadius: 22,
    color: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Poppins_400Regular',
  },
  chatSendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1877F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  chatListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  chatListName: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
    fontFamily: 'Poppins_700Bold',
  },
  chatListLast: {
    color: '#888',
    fontSize: 13,
    marginTop: 3,
    fontFamily: 'Poppins_400Regular',
  },
});