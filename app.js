// ==========================================
// 1. SUPABASE INITIALIZATION
// ==========================================
// Replace with your actual project URL from your browser address bar while in Supabase
const SUPABASE_URL = 'https://YOUR_ACTUAL_PROJECT_ID.supabase.co';
const SUPABASE_KEY = 'sb_publishable_amKPeKhl1DQPlAtdFUdVfQ_TtgyPk_9';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


// ==========================================
// 2. USER AUTHENTICATION
// ==========================================

async function signUpUser(email, password, fullName, phone) {
  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    
    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').insert([
        { id: data.user.id, full_name: fullName, phone: phone }
      ]);
      if (profileError) throw profileError;
    }
    alert("Registration successful! Please check your email/log in.");
    return data;
  } catch (err) {
    console.error("Sign up error:", err.message);
    alert(err.message);
  }
}

async function signInUser(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    alert("Login successful!");
    return data;
  } catch (err) {
    console.error("Login error:", err.message);
    alert(err.message);
  }
}

async function signOutUser() {
  await supabase.auth.signOut();
  window.location.reload();
}


// ==========================================
// 3. LOST & FOUND REPORTS & PHOTO UPLOADS
// ==========================================

async function createReport(reportData, photoFile) {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error("You must be logged in to create a report.");

    let photoUrl = null;

    // Upload photo if provided
    if (photoFile) {
      const fileExt = photoFile.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('item-photos')
        .upload(filePath, photoFile);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('item-photos')
        .getPublicUrl(filePath);

      photoUrl = publicUrlData.publicUrl;
    }

    // Insert into items table
    const { data, error } = await supabase.from('items').insert([{
      user_id: user.id,
      report_type: reportData.reportType, // 'lost' or 'found'
      category: reportData.category,
      description: reportData.description,
      county: reportData.county,
      location: reportData.location,
      item_date: reportData.date,
      photo_url: photoUrl,
      status: 'active'
    }]).select();

    if (error) throw error;

    // Trigger automatic matching engine check if it's a lost item
    if (data && data.length > 0 && reportData.reportType === 'lost') {
      await checkForMatches(data[0]);
    }

    alert("Report posted successfully!");
    return data;
  } catch (err) {
    console.error("Error creating report:", err.message);
    alert(err.message);
  }
}


// ==========================================
// 4. SEARCH SYSTEM
// ==========================================

async function searchItems(filters = {}) {
  try {
    let query = supabase.from('items').select('*, profiles(full_name)').eq('status', 'active');

    if (filters.keyword) {
      query = query.ilike('description', `%${filters.keyword}%`);
    }
    if (filters.category && filters.category !== 'All') {
      query = query.eq('category', filters.category);
    }
    if (filters.reportType && filters.reportType !== 'All') {
      query = query.eq('report_type', filters.reportType);
    }
    if (filters.county && filters.county !== 'All') {
      query = query.eq('county', filters.county);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  } catch (err) {
    console.error("Search error:", err.message);
    return [];
  }
}


// ==========================================
// 5. AUTOMATIC MATCHING ALGORITHM
// ==========================================

async function checkForMatches(newItem) {
  try {
    const oppositeType = newItem.report_type === 'lost' ? 'found' : 'lost';

    const { data: candidates, error } = await supabase
      .from('items')
      .select('*')
      .eq('report_type', oppositeType)
      .eq('category', newItem.category)
      .eq('county', newItem.county)
      .eq('status', 'active');

    if (error || !candidates) return;

    for (let candidate of candidates) {
      // Basic keyword matching check
      if (candidate.description.toLowerCase().includes(newItem.description.toLowerCase().substring(0, 5)) ||
          newItem.description.toLowerCase().includes(candidate.description.toLowerCase().substring(0, 5))) {
        
        const lostId = newItem.report_type === 'lost' ? newItem.id : candidate.id;
        const foundId = newItem.report_type === 'found' ? newItem.id : candidate.id;

        // Save potential match
        await supabase.from('possible_matches').insert([{
          lost_item_id: lostId,
          found_item_id: foundId,
          score: 85
        }]);

        // Send notifications to both users
        await supabase.from('notifications').insert([
          { user_id: newItem.user_id, title: 'Possible Match Found!', body: `We found a potential match for your ${newItem.category} report.` },
          { user_id: candidate.user_id, title: 'Possible Match Found!', body: `We found a potential match for your ${candidate.category} report.` }
        ]);
      }
    }
  } catch (err) {
    console.error("Matching engine error:", err.message);
  }
}


// ==========================================
// 6. PRIVATE MESSAGING
// ==========================================

async function sendMessage(itemId, receiverId, content) {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error("Unauthorized");

    const { data, error } = await supabase.from('messages').insert([{
      item_id: itemId,
      sender_id: user.id,
      receiver_id: receiverId,
      content: content,
      is_read: false
    }]);

    if (error) throw error;
    return data;
  } catch (err) {
    console.error("Error sending message:", err.message);
    alert(err.message);
  }
}
