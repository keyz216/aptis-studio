
// One shared normalizer for deterministic, offline Vietnamese companions.
function viKey(text) {
    const decoder=document.createElement('textarea');
    decoder.innerHTML=String(text??'');
    return decoder.value.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
}
function viTranslation(text) {
    const key=viKey(text),dict=window.VI_TRANSLATIONS||{};
    return dict[key]||dict[key.replace(/^\d+[.]\s*/, '')]||'';
}
function viCompanion(text) {
    const original=viKey(text),translation=viTranslation(text);
    return translation && translation.toLocaleLowerCase('vi')!==original.toLocaleLowerCase('vi') ? translation : '';
}
async function translateToVi(text) { return viTranslation(text); }

function generateSampleAnswer(skill, part, questionIndex = 0) {
    if (skill === 'speaking') {
        if (part === 1) {
            return `I really enjoy talking about this. I usually spend time doing my favorite activities like reading books or listening to music.\n<i style="color:#666">(Mình rất thích nói về chủ đề này. Mình thường dành thời gian làm những việc yêu thích như đọc sách hoặc nghe nhạc.)</i>\n\nIt makes me feel relaxed and happy after a long day. For example, last weekend I stayed at home and enjoyed a good book.\n<i style="color:#666">(Nó giúp mình thư giãn và vui vẻ sau ngày dài. Ví dụ, cuối tuần trước mình đã ở nhà đọc một cuốn sách hay.)</i>`;
        }
        if (part === 2) {
            if (questionIndex === 0) {
                return `In the picture, I can see some people doing an activity outdoors. They look very happy and relaxed.\n<i style="color:#666">(Trong tranh, mình thấy vài người đang hoạt động ngoài trời. Họ trông rất vui vẻ và thư giãn.)</i>\n\nThe weather seems nice and the background is quite beautiful. I think they are enjoying their free time together.\n<i style="color:#666">(Thời tiết có vẻ đẹp và bối cảnh khá tuyệt. Mình nghĩ họ đang tận hưởng thời gian rảnh cùng nhau.)</i>`;
            } else if (questionIndex === 1) {
                return `I usually take part in similar activities during my weekends.\n<i style="color:#666">(Mình thường tham gia các hoạt động tương tự vào cuối tuần.)</i>\n\nI often go out with my friends or family because it helps me relieve stress and stay healthy.\n<i style="color:#666">(Mình hay đi cùng bạn bè hoặc gia đình vì nó giúp giảm căng thẳng và khỏe mạnh.)</i>`;
            } else {
                return `I believe people love these activities because they are good for both physical and mental health.\n<i style="color:#666">(Mình tin mọi người thích những hoạt động này vì chúng tốt cho cả thể chất lẫn tinh thần.)</i>\n\nMoreover, it's a great way to connect with others and enjoy life.\n<i style="color:#666">(Hơn nữa, đây là cách tuyệt vời để kết nối với người khác và tận hưởng cuộc sống.)</i>`;
            }
        }
        if (part === 3) {
            if (questionIndex === 0) {
                return `Both pictures show people engaging in interesting activities. However, in the first picture, the activity takes place outdoors, while in the second picture, it is happening indoors.\n<i style="color:#666">(Cả hai bức tranh đều cho thấy mọi người đang tham gia hoạt động thú vị. Tuy nhiên, ở tranh một là hoạt động ngoài trời, trong khi tranh hai là trong nhà.)</i>\n\nBoth look very appealing in their own ways.\n<i style="color:#666">(Cả hai đều rất hấp dẫn theo cách riêng.)</i>`;
            } else if (questionIndex === 1) {
                return `The main difference is the environment. The first one offers fresh air and nature, whereas the second one provides convenience and comfort.\n<i style="color:#666">(Sự khác biệt chính là môi trường. Cái đầu tiên mang lại không khí trong lành và thiên nhiên, còn cái thứ hai mang lại sự tiện lợi và thoải mái.)</i>`;
            } else {
                return `In my opinion, both have their own benefits. It depends on personal preference, but I personally prefer the first option because it brings me closer to nature.\n<i style="color:#666">(Theo mình, cả hai đều có lợi ích riêng tùy sở thích, nhưng cá nhân mình thích lựa chọn đầu tiên hơn vì nó đưa mình đến gần với thiên nhiên.)</i>`;
            }
        }
        if (part === 4) {
            return `I would like to talk about this topic. First of all, it was a very memorable experience for me. I felt extremely excited and happy at that time.\n<i style="color:#666">(Mình muốn nói về chủ đề này. Đầu tiên, đó là một trải nghiệm rất đáng nhớ với mình. Lúc đó mình cảm thấy cực kỳ hào hứng và vui vẻ.)</i>\n\nSecondly, the reason why it is important is that it taught me many valuable lessons and helped me grow. For example, I learned how to handle difficult situations better.\n<i style="color:#666">(Thứ hai, lý do nó quan trọng là vì nó dạy mình nhiều bài học giá trị và giúp mình trưởng thành. Ví dụ, mình học được cách xử lý tình huống khó khăn tốt hơn.)</i>\n\nFinally, I believe everyone should try this at least once in their life because it brings a lot of positive energy and inspiration.\n<i style="color:#666">(Cuối cùng, mình tin ai cũng nên thử điều này ít nhất một lần trong đời vì nó mang lại nhiều năng lượng tích cực và cảm hứng.)</i>`;
        }
    } else if (skill === 'writing') {
        if (part === 1) {
            return `I usually do it twice a week. / I like pop music. / I go by bus. / I am a student.\n<i style="color:#666">(Trả lời tự do, ngắn gọn 1-5 từ. Ví dụ: Tôi thường làm 2 lần/tuần. / Tôi thích nhạc pop. / Tôi đi xe buýt. / Tôi là sinh viên.)</i>`;
        }
        if (part === 2) {
            return `I am very interested in this club because I want to make new friends and improve my skills.\n<i style="color:#666">(Mình rất quan tâm đến câu lạc bộ này vì mình muốn kết bạn mới và cải thiện kỹ năng.)</i>\n\nI usually spend my free time doing this activity, and it makes me feel wonderful. I hope to learn a lot here.\n<i style="color:#666">(Mình thường dành thời gian rảnh làm việc này, và nó làm mình cảm thấy tuyệt vời. Mình hy vọng sẽ học được nhiều điều ở đây.)</i>`;
        }
        if (part === 3) {
            return `(Hệ thống đã có sẵn đáp án chi tiết cho phần chat này. Nếu chưa có, bạn hãy viết khoảng 30-40 từ thể hiện quan điểm đồng tình: "I completely agree with you. It is a great idea because it helps us save time and enjoy life more. What do you think?")\n<i style="color:#666">(Tôi hoàn toàn đồng ý với bạn. Đó là một ý tưởng tuyệt vời vì nó giúp chúng ta tiết kiệm thời gian và tận hưởng cuộc sống hơn. Bạn nghĩ sao?)</i>`;
        }
        if (part === 4) {
            if (questionIndex === 0) { // Task 1: Informal
                return `Hi there,\n<i style="color:#666">(Chào cậu,)</i>\n\nHow are you? I hope you're doing well. I just heard the news and I am so excited about it.\n<i style="color:#666">(Cậu khỏe không? Hy vọng cậu vẫn ổn. Mình vừa nghe tin và rất hào hứng về nó.)</i>\n\nI think it's a fantastic idea and we should definitely join. Let me know what you think.\n<i style="color:#666">(Mình nghĩ đó là ý tưởng tuyệt vời và chúng ta chắc chắn nên tham gia. Cho mình biết cậu nghĩ sao nhé.)</i>\n\nSee you soon,\n[Your Name]`;
            } else { // Task 2: Formal
                return `Dear Sir/Madam,\n<i style="color:#666">(Kính gửi Ông/Bà,)</i>\n\nI am writing to express my thoughts regarding the recent announcement.\n<i style="color:#666">(Tôi viết thư này để bày tỏ suy nghĩ về thông báo gần đây.)</i>\n\nFirstly, I believe this is a positive step for our community. It will bring many benefits and improve the current situation significantly.\n<i style="color:#666">(Đầu tiên, tôi tin đây là bước tiến tích cực cho cộng đồng. Nó sẽ mang lại nhiều lợi ích và cải thiện đáng kể tình hình hiện tại.)</i>\n\nSecondly, I would like to suggest that we organize a small meeting to discuss this further so everyone can share their opinions.\n<i style="color:#666">(Thứ hai, tôi muốn đề xuất tổ chức một cuộc họp nhỏ để thảo luận thêm nhằm giúp mọi người chia sẻ ý kiến.)</i>\n\nThank you for considering my suggestions. I look forward to hearing from you soon.\n<i style="color:#666">(Cảm ơn vì đã xem xét đề xuất. Mong sớm nhận được phản hồi.)</i>\n\nYours faithfully,\n[Your Name]`;
            }
        }
    }
    return "";
}

window.translateToVi = translateToVi;
window.generateSampleAnswer = generateSampleAnswer;
